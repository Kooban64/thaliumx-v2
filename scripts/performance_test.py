#!/usr/bin/env python3
"""
Performance Baseline Test Script
Runs basic performance checks and establishes baselines
"""

import requests
import time
import statistics
import sys

def measure_response_time(url, num_requests=5):
    """Measure average response time for a URL"""
    times = []

    for i in range(num_requests):
        try:
            start_time = time.time()
            response = requests.get(url, timeout=10)
            end_time = time.time()

            if response.status_code == 200:
                times.append(end_time - start_time)
            else:
                print(f"⚠️  Request {i+1} failed with status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Request {i+1} failed: {e}")

        time.sleep(0.5)  # Brief pause between requests

    if times:
        avg_time = statistics.mean(times)
        min_time = min(times)
        max_time = max(times)
        return avg_time, min_time, max_time
    else:
        return None, None, None

def test_service_performance():
    """Test performance of key services"""
    services = [
        ("Frontend", "http://localhost:3000"),
        ("Backend", "http://localhost:3002/health"),
        ("APISIX", "http://localhost:9080/apisix/status"),
    ]

    results = []

    for name, url in services:
        print(f"🔍 Testing {name} performance...")
        avg_time, min_time, max_time = measure_response_time(url)

        if avg_time is not None:
            results.append((name, avg_time, min_time, max_time))
            print(".3f"        else:
            print(f"❌ {name}: Unable to measure performance")
            results.append((name, None, None, None))

    return results

def main():
    print("⚡ Performance Baseline Testing")
    print("=" * 35)

    results = test_service_performance()

    print("\n📊 Performance Results:")
    print("-" * 50)
    print("<12")
    print("-" * 50)

    successful_tests = 0

    for name, avg_time, min_time, max_time in results:
        if avg_time is not None:
            print("<12")
            successful_tests += 1
        else:
            print("<12")

    print(f"\n📊 Performance Test Summary: {successful_tests}/{len(results)} services tested")

    if successful_tests > 0:
        print("✅ Performance baseline established!")
        return 0
    else:
        print("❌ No performance tests successful")
        return 1

if __name__ == "__main__":
    sys.exit(main())