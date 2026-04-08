#!/usr/bin/env python3
"""
Script to fetch a URL and display response information.
Demonstrates working with external APIs and HTTP requests.
"""
import argparse
import sys

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not installed")
    print("Please install it with: pip install requests")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Fetch URL and display response info')
    parser.add_argument('--url', type=str, required=True, help='URL to fetch')
    parser.add_argument('--timeout', type=int, default=10, help='Request timeout in seconds')
    parser.add_argument('--method', type=str, default='GET', choices=['GET', 'POST', 'PUT', 'DELETE'], help='HTTP method')

    args = parser.parse_args()

    print(f"🌐 Fetching URL: {args.url}")
    print(f"⚙️  Method: {args.method}")
    print(f"⏱️  Timeout: {args.timeout}s")
    print("-" * 70)

    try:
        response = requests.request(
            method=args.method,
            url=args.url,
            timeout=args.timeout
        )

        print(f"\n✅ Response received!")
        print(f"Status Code: {response.status_code} {response.reason}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"Content-Length: {len(response.content)} bytes")

        print("\n📋 Response Headers:")
        for key, value in list(response.headers.items())[:10]:
            print(f"  {key}: {value}")

        if len(response.headers) > 10:
            print(f"  ... and {len(response.headers) - 10} more headers")

        print("\n📄 Response Body (first 500 chars):")
        print("-" * 70)
        body_preview = response.text[:500]
        print(body_preview)
        if len(response.text) > 500:
            print(f"\n... ({len(response.text) - 500} more characters)")

        print("-" * 70)
        print(f"✅ Request completed successfully!")

        # Exit with 0 for success
        sys.exit(0 if response.ok else 1)

    except requests.exceptions.Timeout:
        print(f"\n❌ ERROR: Request timed out after {args.timeout} seconds")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"\n❌ ERROR: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
