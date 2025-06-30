import os
import gitignore_parser


def should_include_file(file_path):
    """Check if a file should be included based on extension and type."""
    # Include common Angular file types
    include_extensions = (".ts", ".html", ".css", ".scss", ".json", ".md", ".js")
    # Exclude binary or unwanted files
    exclude_extensions = (
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".woff",
        ".woff2",
        ".ttf",
        ".svg",
    )
    # Exclude specific files and patterns
    exclude_patterns = (
        "package-lock.json",
        "yarn.lock",
        ".log",
        "npm-debug.log",
        "error.log",
        "debug.log",
        "access.log",
        "firebase.log",
    )

    # Check file extensions and specific file names/patterns
    return (
        file_path.endswith(include_extensions)
        and not file_path.endswith(exclude_extensions)
        and not any(pat in file_path for pat in exclude_patterns)
        and os.path.isfile(file_path)  # Ensure it's a file, not a directory
    )


def process_directory(outfile, project_dir):
    """Walk through a directory and write relevant files to the outfile."""
    # Parse .gitignore if it exists in the specific project directory
    ignore_file = os.path.join(project_dir, ".gitignore")
    ignore = (
        gitignore_parser.parse_gitignore(ignore_file)
        if os.path.exists(ignore_file)
        else lambda x: False
    )

    # Define directories to explicitly exclude
    exclude_dirs = {
        "node_modules",
        "dist",
        "assets",
        "build",
        "logs",
        ".git",
        ".vscode",
        "coverage",
        ".angular",  # Added
        "www",  # Added
        "android",
        "ios",
        "extensions",
    }

    # Walk through the project directory
    for root, dirs, files in os.walk(project_dir):
        # Skip excluded and ignored directories
        dirs[:] = [
            d
            for d in dirs
            if d not in exclude_dirs and not ignore(os.path.join(root, d))
        ]

        for file in files:
            file_path = os.path.join(root, file)
            # Skip ignored files and non-relevant file types
            if ignore(file_path) or not should_include_file(file_path):
                continue

            # Write file path as a header
            outfile.write(f"\n\n--- {file_path} ---\n")
            try:
                with open(file_path, "r", encoding="utf-8") as infile:
                    content = infile.read()
                    outfile.write(content)
            except Exception as e:
                outfile.write(f"Error reading {file_path}: {e}\n")


def main():
    """
    Main function to concatenate files from specified project directories
    into a single output file.
    """
    output_file = "codebase_context.txt"
    # Define the list of project directories to include
    project_dirs = ["./"]

    with open(output_file, "w", encoding="utf-8") as outfile:
        for project_dir in project_dirs:
            if os.path.isdir(project_dir):
                print(f"Processing directory: {project_dir}")
                process_directory(outfile, project_dir)
            else:
                print(f"Warning: Directory not found, skipping: {project_dir}")

    print(f"\nCodebase concatenated into {output_file}")


if __name__ == "__main__":
    main()
