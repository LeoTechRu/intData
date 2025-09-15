#!/usr/bin/env python3
import sys
import re
from pathlib import Path


def main(argv: list[str]) -> int:
    show_line_numbers = False
    pattern = None
    paths: list[str] = []
    it = iter(argv)
    for arg in it:
        if arg in {"-n", "--line-number"}:
            show_line_numbers = True
            continue
        if arg == "-P":
            continue
        pattern = arg
        paths = list(it)
        break
    if pattern is None or not paths:
        print("usage: rg [-n] [-P] pattern path", file=sys.stderr)
        return 2
    try:
        regex = re.compile(pattern)
    except re.error as exc:
        print(f"regex error: {exc}", file=sys.stderr)
        return 2

    matched = False
    for target in paths:
        root = Path(target)
        candidates: list[Path]
        if root.is_dir():
            candidates = [p for p in root.rglob('*') if p.is_file()]
        elif root.exists():
            candidates = [root]
        else:
            continue
        for file in candidates:
            try:
                text = file.read_text(encoding='utf-8')
            except Exception:
                continue
            for idx, line in enumerate(text.splitlines(), start=1):
                if regex.search(line):
                    matched = True
                    if show_line_numbers:
                        print(f"{file}:{idx}:{line}")
                    else:
                        print(f"{file}:{line}")
    return 0 if matched else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
