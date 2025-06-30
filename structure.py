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
    )

    return (
        file_path.endswith(include_extensions)
        and not file_path.endswith(exclude_extensions)
        and not any(pat in file_path for pat in exclude_patterns)
        and os.path.isfile(file_path)  # Ensure it's a file, not a directory
    )


def generate_tree(project_dir=".", output_file="project_tree.txt", level=0, prefix=""):
    """Generate a tree-like structure of the project and write to a file."""
    # Parse .gitignore if it exists
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
        "build",
        "logs",
        ".git",
        ".vscode",
        "coverage",
        ".angular",
        "www",
        "android",
        "ios",
        "assets",
    }

    # Open the output file in append mode
    with open(output_file, "a", encoding="utf-8") as outfile:
        # Walk through the project directory
        for root, dirs, files in os.walk(project_dir, topdown=True):
            # Skip excluded and ignored directories
            dirs[:] = [
                d
                for d in dirs
                if d not in exclude_dirs and not ignore(os.path.join(root, d))
            ]

            # Calculate indentation based on directory depth
            relative_path = os.path.relpath(root, project_dir)
            if relative_path == ".":
                if level == 0:
                    outfile.write(f"{project_dir}\n")
            else:
                indent = "  " * (relative_path.count(os.sep) + level)
                outfile.write(f"{indent}├── {os.path.basename(root)}/\n")

            # Process files in the current directory
            for file in sorted(files):
                file_path = os.path.join(root, file)
                if ignore(file_path) or not should_include_file(file_path):
                    continue
                indent = "  " * (relative_path.count(os.sep) + level + 1)
                outfile.write(f"{indent}├── {file}\n")


def main():
    output_file = "project_tree.txt"
    project_dir = "."  # Current directory (run this in your project root)

    # Clear the output file if it exists
    if os.path.exists(output_file):
        os.remove(output_file)

    generate_tree(project_dir, output_file)
    print(f"Project tree structure written to {output_file}")


if __name__ == "__main__":
    main()
