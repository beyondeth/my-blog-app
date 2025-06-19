"use client";

import React, { useState } from 'react';
import { apiClient } from '../../lib/api';

export default function TestUploadPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Test login
  const testLogin = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing login...');
      const response = await apiClient.login({ email, password });
      setResult(`✅ Login successful: ${JSON.stringify(response, null, 2)}`);
      console.log('✅ Login successful:', response);
    } catch (error) {
      console.error('❌ Login failed:', error);
      setResult(`❌ Login failed: ${JSON.stringify(error, null, 2)}`);
    }
    setLoading(false);
  };

  // Test register
  const testRegister = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing register...');
      const response = await apiClient.register({ 
        email, 
        password, 
        username: email.split('@')[0] + Math.random().toString(36).substr(2, 5)
      });
      setResult(`✅ Register successful: ${JSON.stringify(response, null, 2)}`);
      console.log('✅ Register successful:', response);
    } catch (error) {
      console.error('❌ Register failed:', error);
      setResult(`❌ Register failed: ${JSON.stringify(error, null, 2)}`);
    }
    setLoading(false);
  };

  // Test basic API connectivity
  const testApiConnection = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing API connection...');
      const response = await fetch('http://localhost:3000/api/v1/files/test/s3-connection');
      const data = await response.json();
      setResult(`✅ API Connection: ${JSON.stringify(data, null, 2)}`);
      console.log('✅ API connection successful:', data);
    } catch (error) {
      console.error('❌ API connection failed:', error);
      setResult(`❌ API Connection failed: ${error}`);
    }
    setLoading(false);
  };

  // Test with authentication
  const testAuthenticatedRequest = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing authenticated request...');
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'No token');
      
      const response = await fetch('http://localhost:3000/api/v1/files/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          fileName: 'test.png',
          mimeType: 'image/png',
          fileSize: 1024,
          fileType: 'image'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(`✅ Authenticated Request: ${JSON.stringify(data, null, 2)}`);
      console.log('✅ Authenticated request successful:', data);
    } catch (error) {
      console.error('❌ Authenticated request failed:', error);
      setResult(`❌ Authenticated Request failed: ${error}`);
    }
    setLoading(false);
  };

  // Test using apiClient
  const testApiClient = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing API client...');
      const response = await apiClient.createUploadUrl({
        fileName: 'test.png',
        mimeType: 'image/png',
        fileSize: 1024,
        fileType: 'image'
      });
      setResult(`✅ API Client: ${JSON.stringify(response, null, 2)}`);
      console.log('✅ API client successful:', response);
    } catch (error) {
      console.error('❌ API client failed:', error);
      setResult(`❌ API Client failed: ${JSON.stringify(error, null, 2)}`);
    }
    setLoading(false);
  };

  // Test file upload
  const testFileUpload = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing file upload...');
      
      // Create a dummy file
      const file = new File(['test content'], 'test.png', { type: 'image/png' });
      
      const result = await apiClient.uploadFile(file, 'image');
      setResult(`✅ File Upload: ${JSON.stringify(result, null, 2)}`);
      console.log('✅ File upload successful:', result);
    } catch (error) {
      console.error('❌ File upload failed:', error);
      setResult(`❌ File Upload failed: ${JSON.stringify(error, null, 2)}`);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Upload Debug Test</h1>
      
      {/* Login Form */}
      <div className="bg-white p-4 rounded border mb-6">
        <h2 className="font-bold mb-4">Login/Register</h2>
        <div className="space-y-2 mb-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <input
            type="password"
            placeholder="Password (e.g., Password123)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="space-x-2">
          <button
            onClick={testLogin}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Login
          </button>
          <button
            onClick={testRegister}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Register
          </button>
        </div>
      </div>
      
      {/* Test Buttons */}
      <div className="space-y-4 mb-6">
        <button
          onClick={testApiConnection}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test API Connection
        </button>
        
        <button
          onClick={testAuthenticatedRequest}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Authenticated Request
        </button>
        
        <button
          onClick={testApiClient}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test API Client
        </button>
        
        <button
          onClick={testFileUpload}
          disabled={loading}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
        >
          Test File Upload
        </button>
      </div>
      
      {loading && <div className="text-blue-500">Loading...</div>}
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold mb-2">Result:</h2>
        <pre className="whitespace-pre-wrap text-sm">{result}</pre>
      </div>
    </div>
  );
} 