#!/usr/bin/env python3
"""
Simple hello world script that demonstrates parameter handling.
"""
import argparse
import time


def main():
    parser = argparse.ArgumentParser(description='Say hello to someone')
    parser.add_argument('--name', type=str, default='World', help='Name to greet')
    parser.add_argument('--repeat', type=int, default=1, help='Number of times to repeat')

    args = parser.parse_args()

    print(f"🚀 Starting hello_world script...")
    print(f"Parameters received:")
    print(f"  - name: {args.name}")
    print(f"  - repeat: {args.repeat}")
    print("-" * 50)

    for i in range(args.repeat):
        print(f"[{i+1}/{args.repeat}] Hello, {args.name}! 👋")
        if i < args.repeat - 1:
            time.sleep(0.5)

    print("-" * 50)
    print(f"✅ Completed successfully!")


if __name__ == '__main__':
    main()
