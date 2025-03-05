import os
import subprocess
import glob
import logging
import time
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_webm_timestamps(input_file, output_file=None):
    """
    Fix timestamp issues in WebM files using ffmpeg.
    If output_file is not provided, creates a fixed version with '_fixed' suffix.
    
    Returns the path to the fixed file.
    """
    if output_file is None:
        base, ext = os.path.splitext(input_file)
        output_file = f"{base}_fixed{ext}"
    
    try:
        # Use ffmpeg to remux the file with proper timestamps
        cmd = [
            'ffmpeg', '-i', input_file,
            '-c:v', 'copy',  # Copy video stream without re-encoding
            '-c:a', 'copy',  # Explicitly copy audio stream
            '-fflags', '+genpts',  # Generate presentation timestamps
            output_file
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        logger.info(f"Fixed timestamps in {input_file} -> {output_file}")
        return output_file
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to fix timestamps: {e}")
        return None

def merge_videos(directory, output_file=None):
    """
    Merge all video files in the specified directory.
    Returns the path to the merged file.
    """
    if output_file is None:
        # Create output filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(directory, f"merged_{timestamp}.mp4")
    
    # Get all video files
    video_extensions = ('.mp4', '.webm', '.mkv', '.avi')
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(glob.glob(os.path.join(directory, f"*{ext}")))
    
    video_files.sort()  # Sort files by name (which should be timestamp)
    
    if not video_files:
        logger.warning(f"No video files found in {directory}")
        return None
    
    # Create temporary file list for ffmpeg
    list_file_path = os.path.join(directory, "file_list.txt")
    with open(list_file_path, 'w') as list_file:
        for video_file in video_files:
            # Fix WebM timestamps first
            if video_file.lower().endswith('.webm'):
                fixed_file = fix_webm_timestamps(video_file)
                if fixed_file:
                    list_file.write(f"file '{os.path.basename(fixed_file)}'\n")
            else:
                list_file.write(f"file '{os.path.basename(video_file)}'\n")
    
    try:
        # Use ffmpeg to concatenate the videos
        cmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', list_file_path,
            '-c', 'copy',
            output_file
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        logger.info(f"Successfully merged {len(video_files)} videos into {output_file}")
        
        # Clean up list file
        os.remove(list_file_path)
        
        return output_file
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to merge videos: {e}")
        return None
