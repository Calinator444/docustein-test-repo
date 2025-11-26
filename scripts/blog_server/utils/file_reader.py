import os
import yaml

ROOT_DIR = "..\\..\\..\\content"

def recurse_files(working_dir: str, file_paths: list):
    if(os.path.isfile(os.path.join(working_dir))):
        file_paths.append(working_dir)
        return
    for dir in os.listdir(working_dir):
        recurse_files(os.path.join(working_dir, dir), file_paths)

def list_files(working_dir: str):
    file_paths = []
    recurse_files(working_dir, file_paths)
    return file_paths