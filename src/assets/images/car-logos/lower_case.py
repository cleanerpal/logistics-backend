import os

def rename_files_to_lowercase(directory='./'):
    # List all files and directories in the specified directory
    for filename in os.listdir(directory):
        # Construct the full file path
        full_path = os.path.join(directory, filename)

        # Check if it's a file (not a directory)
        if os.path.isfile(full_path):
            # Create a new filename with lowercase letters
            new_filename = filename.lower()

            # Construct the full new path
            new_full_path = os.path.join(directory, new_filename)

            # Rename the file
            os.rename(full_path, new_full_path)
            print(f"Renamed '{full_path}' to '{new_full_path}'")

        # If it's a directory, we can choose to traverse it recursively if needed
        # Uncomment the next two lines if you wish to also rename files in subdirectories
        # elif os.path.isdir(full_path):
        #     rename_files_to_lowercase(full_path)

# Call the function
rename_files_to_lowercase()
