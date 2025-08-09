#!/usr/bin/env python3
"""
Test script to verify Prometheus proxy endpoints work correctly
"""

import asyncio
import aiohttp
import json

API_BASE = "http://localhost:8000"

async def test_endpoint(session, endpoint, method='GET', data=None):
    """Test a specific endpoint"""
    print(f"Testing {method} {endpoint}...")
    
    try:
        if method == 'POST' and data:
            async with session.post(f"{API_BASE}{endpoint}", 
                                   json=data,
                                   headers={'Content-Type': 'application/json'}) as response:
                result = await response.json()
                print(f"✅ {endpoint}: {response.status} - {len(str(result))} bytes")
                return True
        else:
            async with session.get(f"{API_BASE}{endpoint}") as response:
                result = await response.json()
                print(f"✅ {endpoint}: {response.status} - {len(str(result))} bytes")
                return True
                
    except Exception as e:
        print(f"❌ {endpoint}: {str(e)}")
        return False

async def main():
    """Run all endpoint tests"""
    print("🚀 Testing Prometheus Proxy Endpoints")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        tests = [
            # Health check
            ("/health", "GET"),
            
            # Direct proxy endpoints (these should work)
            ("/prometheus-proxy/metrics", "GET"),
            ("/prometheus-proxy/targets", "GET"), 
            ("/prometheus-proxy/alerts", "GET"),
            ("/prometheus-proxy/query", "POST", {"query": "up"}),
            
            # Status endpoints
            ("/prometheus-proxy/status/buildinfo", "GET"),
            ("/prometheus-proxy/status/runtimeinfo", "GET"),
            ("/prometheus-proxy/status/flags", "GET"),
            ("/prometheus-proxy/status/tsdb", "GET"),
        ]
        
        results = []
        for test in tests:
            endpoint = test[0]
            method = test[1]
            data = test[2] if len(test) > 2 else None
            
            success = await test_endpoint(session, endpoint, method, data)
            results.append(success)
            
            # Small delay between tests
            await asyncio.sleep(0.5)
    
    print("\n" + "=" * 50)
    passed = sum(results)
    total = len(results)
    print(f"📋 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your Prometheus proxy is working correctly.")
    else:
        print("⚠️ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    asyncio.run(main())