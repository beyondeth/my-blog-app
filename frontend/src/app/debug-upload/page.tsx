"use client";

import React, { useState } from 'react';

export default function DebugUploadPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'debug@example.com',
          password: 'Password123'
        })
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      setResult(`✅ Login successful! Token saved.`);
    } catch (error) {
      setResult(`❌ Login failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testUpload = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No token found. Please login first.');
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

      // Step 1: Request upload URL
      console.log('🔍 Requesting upload URL...');
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/files/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: 'test-image.png',
          mimeType: 'image/png',
          fileSize: 1000,
          fileType: 'image'
        })
      });

      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        throw new Error(`Upload URL request failed: ${uploadUrlResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadUrlResponse.json();
      setResult(`✅ Upload test successful! File key: ${uploadData.fileKey}`);
      
    } catch (error) {
      console.error('Upload test failed:', error);
      setResult(`❌ Upload test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testFileUpload = async () => {
    setLoading(true);
    try {
      // Create a fake file
      const fakeFile = new File(['fake content'], 'test.png', { type: 'image/png' });
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No token found. Please login first.');
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

      // Step 1: Request upload URL
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/files/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: fakeFile.name,
          mimeType: fakeFile.type,
          fileSize: fakeFile.size,
          fileType: 'image'
        })
      });

      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        throw new Error(`Upload URL request failed: ${uploadUrlResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadUrlResponse.json();
      
      // Step 2: Upload to S3
      const s3Response = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: fakeFile,
        headers: {
          'Content-Type': fakeFile.type,
        },
      });

      if (!s3Response.ok) {
        throw new Error(`S3 upload failed: ${s3Response.status}`);
      }

      // Step 3: Complete upload
      const fileUrl = `https://myblogdata84.s3.us-east-1.amazonaws.com/${uploadData.fileKey}`;
      const completeResponse = await fetch(`${API_BASE_URL}/files/upload-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileKey: uploadData.fileKey,
          fileUrl: fileUrl,
        })
      });

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        throw new Error(`Upload complete failed: ${completeResponse.status} - ${errorText}`);
      }

      const result = await completeResponse.json();
      setResult(`✅ Full upload test successful! File URL: ${fileUrl}`);
      
    } catch (error) {
      console.error('Full upload test failed:', error);
      setResult(`❌ Full upload test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Debug Page</h1>
      
      <div className="space-y-4">
        <button
          onClick={testLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '1. Test Login'}
        </button>
        
        <button
          onClick={testUpload}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '2. Test Upload URL Request'}
        </button>
        
        <button
          onClick={testFileUpload}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '3. Test Full Upload Process'}
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Result:</h3>
        <pre className="whitespace-pre-wrap">{result}</pre>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Open browser console to see detailed logs.</p>
        <p>Current token: {localStorage.getItem('access_token') ? 'Present' : 'Not found'}</p>
      </div>
    </div>
  );
} 