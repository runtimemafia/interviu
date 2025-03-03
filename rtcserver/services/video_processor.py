import logging
import os
import subprocess
import tempfile
from typing import List, Optional, Dict, Any
import time
import shutil

logger = logging.getLogger(__name__)

class VideoProcessor:
    def check_file_validity(self, file_path: str) -> bool:
        """Check if a video file is valid using FFprobe"""
        try:
            if not os.path.exists(file_path):
                logger.error(f"File does not exist: {file_path}")
                return False
                
            if os.path.getsize(file_path) == 0:
                logger.error(f"File is empty: {file_path}")
                return False
                
            # First perform a quick check to see if the file has valid headers
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_type',
                '-of', 'csv=p=0',
                file_path
            ]
            
            logger.info(f"Validating file: {file_path}")
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=10  # Add timeout to prevent hanging
            )
            
            # Log the ffprobe result for debugging
            logger.info(f"FFprobe stdout: '{process.stdout.strip()}'")
            if process.stderr:
                logger.info(f"FFprobe stderr: '{process.stderr.strip()}'")
            
            # If we get 'video' as output, the file has a valid video stream
            if process.stdout.strip() == 'video':
                logger.info(f"File validated as valid video: {file_path}")
                return True
            else:
                logger.warning(f"File is not a valid video: {file_path}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error(f"Validation timed out for {file_path}")
            return False
        except Exception as e:
            logger.error(f"Error checking file validity for {file_path}: {e}")
            return False
            
    def get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Get information about a video file"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file_path
            ]
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=10
            )
            
            if process.returncode != 0:
                logger.error(f"Error getting video info: {process.stderr}")
                return {}
                
            import json
            return json.loads(process.stdout)
        except Exception as e:
            logger.error(f"Error getting video info for {file_path}: {e}")
            return {}

    async def merge_chunks(self, chunk_paths: List[str], output_path: str) -> bool:
        """
        Merge video chunks using FFmpeg
        
        Args:
            chunk_paths: List of paths to video chunk files
            output_path: Path to save the merged video
            
        Returns:
            bool: True if merging was successful, False otherwise
        """
        try:
            if not chunk_paths:
                logger.error("No chunks provided for merging")
                return False
                
            # Filter out invalid or empty chunk files
            valid_chunks = []
            for path in chunk_paths:
                if os.path.exists(path) and os.path.getsize(path) > 0:
                    valid_chunks.append(path)
                else:
                    logger.warning(f"Skipping non-existent or empty file: {path}")
            
            if not valid_chunks:
                logger.error("No valid video chunks found for merging")
                return False
            
            # Log chunk info for debugging
            for i, chunk in enumerate(valid_chunks):
                info = self.get_video_info(chunk)
                streams = info.get('streams', [])
                format_info = info.get('format', {})
                
                stream_types = [s.get('codec_type') for s in streams]
                codec_names = [s.get('codec_name') for s in streams]
                
                logger.info(f"Chunk {i}: {os.path.basename(chunk)}")
                logger.info(f"  Size: {os.path.getsize(chunk)} bytes")
                logger.info(f"  Format: {format_info.get('format_name')}")
                logger.info(f"  Duration: {format_info.get('duration')}s")
                logger.info(f"  Stream types: {stream_types}")
                logger.info(f"  Codecs: {codec_names}")
                
            # Create a temporary directory for working files
            temp_dir = tempfile.mkdtemp(prefix="rtcserver_")
            try:
                # Try the direct concat method first
                success = await self._try_concat_demuxer(valid_chunks, output_path, temp_dir)
                
                if not success:
                    logger.warning("Concat demuxer method failed, trying transcoding method...")
                    success = await self._try_transcoding_method(valid_chunks, output_path, temp_dir)
                    
                if not success:
                    logger.warning("Transcoding method failed, trying concat filter...")
                    success = await self._try_concat_filter(valid_chunks, output_path)
                
                # Verify the output file was created and is valid
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    if self.check_file_validity(output_path):
                        logger.info(f"Successfully merged {len(valid_chunks)} chunks to {output_path}")
                        return True
                    else:
                        logger.error(f"Output file exists but is not a valid video: {output_path}")
                        return False
                else:
                    logger.error(f"Output file was not created or is empty: {output_path}")
                    return False
                    
            finally:
                # Clean up temp directory
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except Exception as e:
            logger.error(f"Error merging video chunks: {str(e)}")
            return False
    
    async def _try_concat_demuxer(self, chunks: List[str], output_path: str, temp_dir: str) -> bool:
        """Try merging using FFmpeg's concat demuxer"""
        try:
            # Create a temporary file listing all chunks
            concat_file = os.path.join(temp_dir, "concat_list.txt")
            with open(concat_file, 'w') as f:
                for chunk_path in chunks:
                    f.write(f"file '{os.path.abspath(chunk_path)}'\n")
            
            # Use FFmpeg to concatenate the chunks
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_file,
                '-c', 'copy',  # Copy streams without re-encoding
                '-y',  # Overwrite output file if it exists
                output_path
            ]
            
            logger.info(f"Executing FFmpeg concat demuxer: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=300  # 5 minute timeout
            )
            
            if process.returncode == 0:
                logger.info("Concat demuxer method successful")
                return True
            else:
                logger.error(f"Concat demuxer method failed: {process.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error in concat demuxer method: {e}")
            return False
    
    async def _try_transcoding_method(self, chunks: List[str], output_path: str, temp_dir: str) -> bool:
        """Try transcoding each chunk to the same format before merging"""
        try:
            # Create a directory for normalized chunks
            normalized_dir = os.path.join(temp_dir, "normalized")
            os.makedirs(normalized_dir, exist_ok=True)
            
            normalized_chunks = []
            
            # Transcode each chunk to ensure consistency
            for i, chunk_path in enumerate(chunks):
                output_file = os.path.join(normalized_dir, f"norm_{i:04d}.mp4")
                
                # Transcode to H.264 MP4 format
                cmd = [
                    'ffmpeg',
                    '-i', chunk_path,
                    '-c:v', 'libx264',  # Use H.264 codec for video
                    '-c:a', 'aac',       # Use AAC codec for audio
                    '-strict', 'experimental',
                    '-b:a', '192k',
                    '-y',
                    output_file
                ]
                
                logger.info(f"Transcoding chunk {i}: {' '.join(cmd)}")
                
                process = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=False,
                    timeout=120  # 2 minute timeout per chunk
                )
                
                if process.returncode == 0 and os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                    normalized_chunks.append(output_file)
                else:
                    logger.error(f"Failed to transcode chunk {i}: {process.stderr}")
            
            if not normalized_chunks:
                logger.error("No chunks were successfully transcoded")
                return False
                
            # Now merge the normalized chunks
            concat_file = os.path.join(temp_dir, "normalized_list.txt")
            with open(concat_file, 'w') as f:
                for norm_chunk in normalized_chunks:
                    f.write(f"file '{os.path.abspath(norm_chunk)}'\n")
            
            # Use FFmpeg to concatenate the normalized chunks
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_file,
                '-c', 'copy',
                '-y',
                output_path
            ]
            
            logger.info(f"Executing FFmpeg on normalized chunks: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=300  # 5 minute timeout
            )
            
            if process.returncode == 0:
                logger.info("Transcoding method successful")
                return True
            else:
                logger.error(f"Transcoding method failed: {process.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error in transcoding method: {e}")
            return False

    async def _try_concat_filter(self, chunks: List[str], output_path: str) -> bool:
        """Try using FFmpeg's concat filter"""
        try:
            # Create inputs and filter complex arguments
            inputs = []
            filter_parts = []
            
            for i, chunk_path in enumerate(chunks):
                inputs.extend(['-i', chunk_path])
                
                # Create filter part for this input
                # Both video and audio if available, otherwise just video
                info = self.get_video_info(chunk_path)
                streams = info.get('streams', [])
                
                has_video = any(s.get('codec_type') == 'video' for s in streams)
                has_audio = any(s.get('codec_type') == 'audio' for s in streams)
                
                if has_video and has_audio:
                    filter_parts.append(f"[{i}:v:0][{i}:a:0]")
                elif has_video:
                    filter_parts.append(f"[{i}:v:0]")
                else:
                    logger.warning(f"Chunk {i} has no valid streams, skipping in filter")
                    continue
            
            if not filter_parts:
                logger.error("No valid streams found in any chunks")
                return False
                
            # Build the concat filter
            if all(len(part.split(']')) > 2 for part in filter_parts):  # If all parts have video and audio
                filter_complex = ''.join(filter_parts) + f"concat=n={len(filter_parts)}:v=1:a=1[outv][outa]"
                map_args = ['-map', '[outv]', '-map', '[outa]']
            else:  # Only video available
                filter_complex = ''.join(filter_parts) + f"concat=n={len(filter_parts)}:v=1[outv]"
                map_args = ['-map', '[outv]']
            
            # Build the command
            cmd = [
                'ffmpeg',
                *inputs,
                '-filter_complex', filter_complex,
                *map_args,
                '-preset', 'medium',  # Balance between speed and quality
                '-y',
                output_path
            ]
            
            logger.info(f"Executing FFmpeg concat filter: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=600  # 10 minute timeout
            )
            
            if process.returncode == 0:
                logger.info("Concat filter method successful")
                return True
            else:
                logger.error(f"Concat filter method failed: {process.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error in concat filter method: {e}")
            return False
