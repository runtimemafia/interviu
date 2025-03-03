#!/usr/bin/env python3
"""
Debug utility for checking video files and sessions
"""

import os
import sys
import json
import subprocess
import argparse
from typing import Dict, List, Any, Optional
import glob
import datetime


def check_file(filepath: str, verbose: bool = False) -> Dict[str, Any]:
    """Check if a video file is valid and return info about it"""
    result = {
        "path": filepath,
        "exists": os.path.exists(filepath),
        "size": os.path.getsize(filepath) if os.path.exists(filepath) else 0,
        "valid": False,
        "error": None,
        "info": {}
    }
    
    if not result["exists"]:
        result["error"] = "File does not exist"
        return result
        
    if result["size"] == 0:
        result["error"] = "File is empty"
        return result
    
    try:
        # Check if file is a valid video using ffprobe
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_type',
            '-of', 'csv=p=0',
            filepath
        ]
        
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            timeout=10
        )
        
        result["valid"] = proc.returncode == 0 and proc.stdout.strip() == 'video'
        
        if proc.stderr:
            result["error"] = proc.stderr.strip()
            
        # If requested, get detailed info about the video
        if verbose and result["valid"]:
            info_cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                filepath
            ]
            
            info_proc = subprocess.run(
                info_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            
            if info_proc.returncode == 0:
                try:
                    result["info"] = json.loads(info_proc.stdout)
                except json.JSONDecodeError:
                    result["info"] = {"error": "Could not parse ffprobe output"}
            else:
                result["info"] = {"error": info_proc.stderr.strip()}
                
    except subprocess.TimeoutExpired:
        result["error"] = "Timeout checking file"
    except Exception as e:
        result["error"] = str(e)
        
    return result


def check_session(session_dir: str, verbose: bool = False) -> Dict[str, Any]:
    """Check a session directory and all its video files"""
    result = {
        "path": session_dir,
        "exists": os.path.exists(session_dir),
        "session_info": None,
        "chunks": [],
        "final_video": None,
        "errors": []
    }
    
    if not result["exists"]:
        result["errors"].append(f"Session directory {session_dir} does not exist")
        return result
    
    # Check for session info file
    session_info_path = os.path.join(session_dir, "session_info.json")
    if os.path.exists(session_info_path):
        try:
            with open(session_info_path, 'r') as f:
                result["session_info"] = json.load(f)
        except Exception as e:
            result["errors"].append(f"Error reading session info: {str(e)}")
    else:
        result["errors"].append("No session_info.json found")
    
    # Check for video chunks
    chunk_pattern = os.path.join(session_dir, "chunk_*.???")
    chunk_files = sorted(glob.glob(chunk_pattern))
    
    if not chunk_files:
        result["errors"].append("No video chunks found")
    
    # Check each chunk
    for chunk_file in chunk_files:
        chunk_info = check_file(chunk_file, verbose)
        result["chunks"].append(chunk_info)
    
    # Check for final video
    final_video_mp4 = os.path.join(session_dir, "complete_recording.mp4")
    final_video_webm = os.path.join(session_dir, "complete_recording.webm")
    
    if os.path.exists(final_video_mp4):
        result["final_video"] = check_file(final_video_mp4, verbose)
    elif os.path.exists(final_video_webm):
        result["final_video"] = check_file(final_video_webm, verbose)
    else:
        result["errors"].append("No final video found")
    
    return result


def check_all_sessions(base_dir: str, verbose: bool = False) -> List[Dict[str, Any]]:
    """Check all sessions in the uploads directory"""
    sessions = []
    
    if not os.path.exists(base_dir):
        print(f"Error: Directory {base_dir} does not exist")
        return sessions
    
    # Find all subdirectories which are likely sessions
    for item in os.listdir(base_dir):
        session_dir = os.path.join(base_dir, item)
        if os.path.isdir(session_dir):
            # Check if it looks like a session directory
            if os.path.exists(os.path.join(session_dir, "session_info.json")) or \
               glob.glob(os.path.join(session_dir, "chunk_*.*")):
                session_info = check_session(session_dir, verbose)
                sessions.append(session_info)
    
    return sessions


def repair_session(session_dir: str, force: bool = False) -> bool:
    """
    Attempt to repair a session by regenerating the final video
    from available chunks
    """
    print(f"Attempting to repair session: {session_dir}")
    
    if not os.path.exists(session_dir):
        print(f"Error: Session directory {session_dir} does not exist")
        return False
    
    # Check for chunks
    chunk_pattern = os.path.join(session_dir, "chunk_*.???")
    chunk_files = sorted(glob.glob(chunk_pattern))
    
    if not chunk_files:
        print("Error: No video chunks found to repair session")
        return False
    
    # Check for existing final video
    final_video_mp4 = os.path.join(session_dir, "complete_recording.mp4")
    final_video_webm = os.path.join(session_dir, "complete_recording.webm")
    
    final_exists = os.path.exists(final_video_mp4) or os.path.exists(final_video_webm)
    
    if final_exists and not force:
        print("Final video already exists. Use --force to override")
        return False
    
    # Count mp4 vs webm chunks to determine output format
    mp4_count = len([f for f in chunk_files if f.endswith('.mp4')])
    webm_count = len([f for f in chunk_files if f.endswith('.webm')])
    
    output_format = "mp4" if mp4_count >= webm_count else "webm"
    output_path = os.path.join(session_dir, f"complete_recording.{output_format}")
    
    # Create a temporary file with the list of chunks
    temp_file = os.path.join(session_dir, "concat_list.txt")
    try:
        with open(temp_file, 'w') as f:
            for chunk in chunk_files:
                if os.path.getsize(chunk) > 0:
                    f.write(f"file '{os.path.abspath(chunk)}'\n")
        
        # Try to merge with ffmpeg
        cmd = [
            'ffmpeg',
            '-f', 'concat',
            '-safe', '0',
            '-i', temp_file,
            '-c', 'copy',
            '-y',
            output_path
        ]
        
        print(f"Executing: {' '.join(cmd)}")
        
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            timeout=300
        )
        
        if proc.returncode == 0:
            print(f"Successfully created {output_path}")
            
            # Update session info if it exists
            session_info_path = os.path.join(session_dir, "session_info.json")
            if os.path.exists(session_info_path):
                try:
                    with open(session_info_path, 'r') as f:
                        session_info = json.load(f)
                    
                    session_info["completed"] = True
                    session_info["completed_at"] = datetime.datetime.now().isoformat()
                    session_info["output_path"] = output_path
                    
                    with open(session_info_path, 'w') as f:
                        json.dump(session_info, f, indent=2)
                    
                    print("Updated session_info.json")
                except Exception as e:
                    print(f"Warning: Could not update session info: {e}")
            
            return True
        else:
            print(f"Error merging video chunks: {proc.stderr}")
            return False
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_file):
            os.unlink(temp_file)


def print_report(result: Dict[str, Any], verbose: bool = False):
    """Print a formatted report about the session or file"""
    if "chunks" in result:  # This is a session report
        print(f"\n===== Session: {os.path.basename(result['path'])} =====")
        
        # Print session info summary
        if result["session_info"]:
            session_info = result["session_info"]
            print(f"Created: {session_info.get('created_at', 'unknown')}")
            print(f"Completed: {session_info.get('completed', False)}")
            if session_info.get("completed_at"):
                print(f"Completed at: {session_info['completed_at']}")
            print(f"Total chunks: {len(session_info.get('chunks', []))}")
        else:
            print("No session info available")
        
        # Print chunk summary
        valid_chunks = sum(1 for c in result["chunks"] if c["valid"])
        print(f"\nFound {len(result['chunks'])} chunks, {valid_chunks} valid")
        
        if verbose:
            for i, chunk in enumerate(result["chunks"]):
                status = "✅" if chunk["valid"] else "❌"
                print(f"  {status} Chunk {i}: {os.path.basename(chunk['path'])}, {chunk['size']} bytes")
                if not chunk["valid"] and chunk["error"]:
                    print(f"     Error: {chunk['error']}")
        
        # Print final video info
        if result["final_video"]:
            status = "✅" if result["final_video"]["valid"] else "❌"
            print(f"\nFinal video: {status} {os.path.basename(result['final_video']['path'])}, {result['final_video']['size']} bytes")
            
            if not result["final_video"]["valid"] and result["final_video"]["error"]:
                print(f"  Error: {result['final_video']['error']}")
        else:
            print("\nNo final video found")
        
        # Print errors
        if result["errors"]:
            print("\nErrors:")
            for error in result["errors"]:
                print(f"  - {error}")
    
    else:  # This is a file report
        status = "✅" if result["valid"] else "❌"
        print(f"{status} {os.path.basename(result['path'])}, {result['size']} bytes")
        
        if not result["valid"] and result["error"]:
            print(f"  Error: {result['error']}")
        
        if verbose and result["info"]:
            print("\nFile info:")
            print(json.dumps(result["info"], indent=2))


def main():
    parser = argparse.ArgumentParser(description="Debug tool for video files and sessions")
    
    # Create subcommands
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Check file command
    file_parser = subparsers.add_parser("file", help="Check a video file")
    file_parser.add_argument("file", help="Path to the video file")
    file_parser.add_argument("-v", "--verbose", action="store_true", help="Show detailed information")
    
    # Check session command
    session_parser = subparsers.add_parser("session", help="Check a session directory")
    session_parser.add_argument("session", help="Path to the session directory")
    session_parser.add_argument("-v", "--verbose", action="store_true", help="Show detailed information")
    
    # Check all sessions command
    all_parser = subparsers.add_parser("all", help="Check all sessions in uploads directory")
    all_parser.add_argument("-d", "--dir", default="uploads", help="Base directory containing sessions")
    all_parser.add_argument("-v", "--verbose", action="store_true", help="Show detailed information")
    
    # Repair session command
    repair_parser = subparsers.add_parser("repair", help="Attempt to repair a session by regenerating the final video")
    repair_parser.add_argument("session", help="Path to the session directory")
    repair_parser.add_argument("-f", "--force", action="store_true", help="Force regeneration even if final video exists")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    if args.command == "file":
        result = check_file(args.file, args.verbose)
        print_report(result, args.verbose)
        
    elif args.command == "session":
        result = check_session(args.session, args.verbose)
        print_report(result, args.verbose)
        
    elif args.command == "all":
        results = check_all_sessions(args.dir, args.verbose)
        
        if not results:
            print(f"No sessions found in {args.dir}")
            return 1
            
        print(f"Found {len(results)} sessions")
        
        for result in results:
            print_report(result, args.verbose)
            
    elif args.command == "repair":
        success = repair_session(args.session, args.force)
        
        if success:
            print("Repair successful")
            return 0
        else:
            print("Repair failed")
            return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())