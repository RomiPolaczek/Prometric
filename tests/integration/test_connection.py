#!/usr/bin/env python3
"""
Diagnostic script to test Prometheus connections
"""

import asyncio
import aiohttp
import os

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
API_URL = "http://localhost:8000"

async def test_direct_prometheus():
    """Test direct connection to Prometheus"""
    print("🔍 Testing direct Prometheus connection...")
    print(f"URL: {PROMETHEUS_URL}")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test basic connection
            async with session.get(f"{PROMETHEUS_URL}/api/v1/query?query=up") as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Direct Prometheus connection works!")
                    print(f"Query result count: {len(data.get('data', {}).get('result', []))}")
                    return True
                else:
                    print(f"❌ Failed with status {response.status}")
                    return False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

async def test_prometheus_targets():
    """Test Prometheus targets endpoint"""
    print("\n🎯 Testing Prometheus targets endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{PROMETHEUS_URL}/api/v1/targets") as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    targets = data.get('data', {}).get('activeTargets', [])
                    print(f"✅ Targets endpoint works!")
                    print(f"Active targets: {len(targets)}")
                    
                    if targets:
                        print("Sample target:")
                        target = targets[0]
                        print(f"  URL: {target.get('scrapeUrl', 'N/A')}")
                        print(f"  Health: {target.get('health', 'N/A')}")
                        print(f"  Job: {target.get('labels', {}).get('job', 'N/A')}")
                    
                    return True
                else:
                    text = await response.text()
                    print(f"❌ Failed with status {response.status}")
                    print(f"Response: {text[:200]}...")
                    return False
    except Exception as e:
        print(f"❌ Targets test failed: {e}")
        return False

async def test_api_proxy():
    """Test our API proxy to Prometheus"""
    print("\n🔄 Testing API proxy...")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test proxy to targets
            async with session.get(f"{API_URL}/api/v1/targets") as response:
                print(f"Proxy status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ API proxy works!")
                    return True
                else:
                    text = await response.text()
                    print(f"❌ Proxy failed with status {response.status}")
                    print(f"Response: {text[:200]}...")
                    return False
    except Exception as e:
        print(f"❌ Proxy test failed: {e}")
        return False

async def test_api_health():
    """Test our API health endpoint"""
    print("\n❤️ Testing API health...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_URL}/health") as response:
                print(f"Health status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ API health: {data.get('status', 'unknown')}")
                    prom_status = data.get('prometheus_connection', {})
                    print(f"Prometheus connection: {prom_status.get('status', 'unknown')}")
                    return True
                else:
                    text = await response.text()
                    print(f"❌ Health check failed: {text}")
                    return False
    except Exception as e:
        print(f"❌ Health test failed: {e}")
        return False

async def test_metrics_sample():
    """Test getting metrics from Prometheus"""
    print("\n📊 Testing metrics retrieval...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{PROMETHEUS_URL}/api/v1/label/__name__/values") as response:
                if response.status == 200:
                    data = await response.json()
                    metrics = data.get('data', [])
                    print(f"✅ Found {len(metrics)} metrics")
                    
                    if metrics:
                        print("Sample metrics:")
                        for metric in metrics[:10]:
                            print(f"  - {metric}")
                        if len(metrics) > 10:
                            print(f"  ... and {len(metrics) - 10} more")
                    
                    # Test some patterns
                    patterns_to_test = ['prometheus_*', 'go_*', 'up']
                    for pattern in patterns_to_test:
                        regex_pattern = pattern.replace('*', '.*')
                        import re
                        compiled = re.compile(f"^{regex_pattern}$")
                        matches = [m for m in metrics if compiled.match(m)]
                        print(f"Pattern '{pattern}' matches {len(matches)} metrics")
                        if matches:
                            print(f"  Examples: {', '.join(matches[:3])}")
                    
                    return True
                else:
                    print(f"❌ Failed to get metrics: {response.status}")
                    return False
    except Exception as e:
        print(f"❌ Metrics test failed: {e}")
        return False

async def main():
    """Run all diagnostic tests"""
    print("🚀 Prometheus Connection Diagnostics")
    print("=" * 50)
    
    results = []
    
    # Test direct Prometheus connection
    results.append(await test_direct_prometheus())
    
    # Test targets endpoint
    results.append(await test_prometheus_targets())
    
    # Test API health
    results.append(await test_api_health())
    
    # Test API proxy
    results.append(await test_api_proxy())
    
    # Test metrics
    results.append(await test_metrics_sample())
    
    print("\n" + "=" * 50)
    print(f"📋 Summary: {sum(results)}/{len(results)} tests passed")
    
    if all(results):
        print("✅ All tests passed! Your setup should be working.")
    else:
        print("❌ Some tests failed. Check the output above for details.")
        
        print("\n🔧 Troubleshooting tips:")
        print("1. Make sure Prometheus is running and accessible")
        print("2. Check your PROMETHEUS_URL environment variable")
        print("3. Ensure your API server is running on port 8000")
        print("4. Verify network connectivity between containers (if using Docker)")

if __name__ == "__main__":
    asyncio.run(main())