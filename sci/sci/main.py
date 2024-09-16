import os
import git
from pathlib import Path

supported_file_extensions = [
    ".ts"
]

def read_bare_repo(repo_path, supported_file_extensions):
    repo = git.Repo(repo_path)
    commit = repo.head.commit
    for blob in commit.tree.traverse():
        if not blob.type  == 'blob':
            continue

        language = Path(blob.path).suffix.lower()
        if language not in supported_file_extensions:
            continue

        content = blob.data_stream.read()
        yield (
            blob.path.__str__(),
            content.decode("utf-8")
        )


def main():
    bare_repository_path = os.path.expanduser("~/zoekt-serving/repos/github.com/TaqlaAI/sourcebot.git")
    files = list(read_bare_repo(bare_repository_path, supported_file_extensions))
    print(len(files))

if __name__ == "__main__":
    main()
    