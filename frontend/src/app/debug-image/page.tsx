"use client";

import { useState } from 'react';
import ImageProxy from '../../components/ui/ImageProxy';
import { apiClient } from '../../lib/api';

export default function DebugImagePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testS3Connection = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/files/test/s3-connection');
      const result = await response.json();
      console.log('S3 Connection Test Result:', result);
      alert(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('S3 Connection Test Error:', error);
      alert('S3 연결 테스트 실패: ' + error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getPosts({ page: 1, limit: 5 });
      setPosts(response.posts);
      console.log('📊 [DEBUG] Fetched posts:', response.posts);
    } catch (error) {
      console.error('❌ [DEBUG] Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 테스트용 S3 이미지 URL
  const testImageUrl = "https://myblogdata84.s3.us-east-1.amazonaws.com/uploads/image/2025/06/스크린샷 2025-06-18 오후 10.06.49-0bd4a8d3-d63f-4f34-bd8d-4cf424cc5889.png";

  const checkS3Files = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/files/test/s3-files');
      const result = await response.json();
      
      console.log('📁 [S3 FILES] Result:', result);
      
      if (result.status === 'success') {
        console.log(`📁 [S3 FILES] Found ${result.total} files:`);
        result.files.forEach((file: string, index: number) => {
          console.log(`  ${index + 1}. ${file}`);
        });
      }
    } catch (error) {
      console.error('❌ [S3 FILES] Error:', error);
    }
  };

  const checkDbFiles = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/files/test/db-files');
      const result = await response.json();
      
      console.log('🗄️ [DB FILES] Result:', result);
      
      if (result.status === 'success') {
        console.log(`🗄️ [DB FILES] Found ${result.total} files:`);
        result.files.forEach((file: any, index: number) => {
          console.log(`  ${index + 1}. ID: ${file.id}, URL: ${file.fileUrl}, Name: ${file.fileName}`);
        });
      }
    } catch (error) {
      console.error('❌ [DB FILES] Error:', error);
    }
  };

  const compareFiles = async () => {
    try {
      // S3 파일 목록 가져오기
      const s3Response = await fetch('http://localhost:3000/api/v1/files/test/s3-files');
      const s3Result = await s3Response.json();
      
      // DB 파일 목록 가져오기
      const dbResponse = await fetch('http://localhost:3000/api/v1/files/test/db-files');
      const dbResult = await dbResponse.json();
      
      if (s3Result.status === 'success' && dbResult.status === 'success') {
        console.log('🔍 [COMPARE] S3 vs DB Files:');
        console.log(`📁 S3 Files: ${s3Result.total}`);
        console.log(`🗄️ DB Files: ${dbResult.total}`);
        
        // DB 파일 URL에서 S3 키 추출
        const dbS3Keys = dbResult.files.map((file: any) => {
          const url = file.fileUrl;
          // S3 URL에서 키 추출
          if (url.includes('amazonaws.com/')) {
            return url.split('amazonaws.com/')[1]?.split('?')[0];
          }
          return null;
        }).filter(Boolean);
        
        console.log('🔍 [COMPARE] DB에서 추출한 S3 키들:');
        dbS3Keys.forEach((key: string, index: number) => {
          console.log(`  ${index + 1}. ${key}`);
        });
        
        // 매칭되지 않는 파일들 찾기
        const s3Files = s3Result.files;
        const unmatchedS3 = s3Files.filter((s3File: string) => !dbS3Keys.includes(s3File));
        const unmatchedDb = dbS3Keys.filter((dbKey: string) => !s3Files.includes(dbKey));
        
        console.log('⚠️ [COMPARE] S3에만 있는 파일들:');
        unmatchedS3.forEach((file: string, index: number) => {
          console.log(`  ${index + 1}. ${file}`);
        });
        
        console.log('⚠️ [COMPARE] DB에만 있는 파일들:');
        unmatchedDb.forEach((file: string, index: number) => {
          console.log(`  ${index + 1}. ${file}`);
        });
      }
    } catch (error) {
      console.error('❌ [COMPARE] Error:', error);
    }
  };

  const testSpecificFile = async () => {
    // DB에만 있는 인코딩된 파일 중 하나를 테스트
    const encodedFileKey = 'uploads/image/2025/06/%E1%84%89%E1%85%B3%E1%84%8F%E1%85%B3%E1%84%85%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A3%E1%86%BA%202025-06-19%20%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE%205.51.10-52e4045c-f94f-4e25-a9e8-22bbf64de850.png';
    const proxyUrl = `http://localhost:3000/api/v1/files/proxy/${encodedFileKey}`;
    
    console.log('🧪 [TEST SPECIFIC] Testing encoded file:', encodedFileKey);
    console.log('🧪 [TEST SPECIFIC] Proxy URL:', proxyUrl);
    
    try {
      const response = await fetch(proxyUrl);
      console.log('📊 [TEST SPECIFIC] Response status:', response.status);
      console.log('📊 [TEST SPECIFIC] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('✅ [TEST SPECIFIC] Image blob received:', blob.size, 'bytes');
        alert(`성공! 이미지 크기: ${blob.size} bytes`);
      } else {
        const text = await response.text();
        console.log('❌ [TEST SPECIFIC] Error response:', text);
        alert(`실패: ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error('❌ [TEST SPECIFIC] Fetch error:', error);
      alert(`에러: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const debugPost = async () => {
    const postSlug = '2025-06-19-123-716612';
    
    try {
      const response = await fetch(`http://localhost:3000/api/v1/posts/debug/${postSlug}`);
      const result = await response.json();
      
      console.log('🔍 [POST DEBUG] Result:', result);
      
      if (result.status === 'success') {
        console.log('📝 [POST DEBUG] Post info:');
        console.log('  - ID:', result.post.id);
        console.log('  - Title:', result.post.title);
        console.log('  - Slug:', result.post.slug);
        console.log('  - Thumbnail:', result.post.thumbnail);
        console.log('  - Content Length:', result.post.contentLength);
        console.log('  - Content Preview:', result.post.contentPreview);
        console.log('🖼️ [POST DEBUG] Extracted Image URLs:');
        result.post.extractedImageUrls.forEach((url: string, index: number) => {
          console.log(`  ${index + 1}. ${url}`);
        });
      }
    } catch (error) {
      console.error('❌ [POST DEBUG] Error:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">이미지 로딩 디버그</h1>
      
      {/* 기존 테스트들 */}
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">1. ImageProxy 컴포넌트 테스트</h2>
          <div className="border p-4 bg-gray-50">
            <ImageProxy
              src={testImageUrl}
              alt="테스트 이미지"
              className="w-64 h-48 object-cover border"
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            S3 URL: {testImageUrl}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">2. 일반 img 태그 테스트</h2>
          <div className="border p-4 bg-gray-50">
            <img 
              src={testImageUrl}
              alt="테스트 이미지 (일반)"
              className="w-64 h-48 object-cover border"
              onLoad={() => console.log('✅ [DEBUG] 일반 img 태그 로드 성공')}
              onError={() => console.log('❌ [DEBUG] 일반 img 태그 로드 실패')}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">3. 프록시 URL 직접 테스트</h2>
          <div className="border p-4 bg-gray-50">
            <img 
              src="http://localhost:3000/api/v1/files/proxy/uploads/image/2025/06/스크린샷 2025-06-18 오후 10.06.49-0bd4a8d3-d63f-4f34-bd8d-4cf424cc5889.png"
              alt="테스트 이미지 (프록시)"
              className="w-64 h-48 object-cover border"
              onLoad={() => console.log('✅ [DEBUG] 프록시 URL 로드 성공')}
              onError={() => console.log('❌ [DEBUG] 프록시 URL 로드 실패')}
            />
          </div>
        </section>

        {/* 새로 추가: 실제 포스트 썸네일 테스트 */}
        <section>
          <h2 className="text-lg font-semibold mb-4">4. 실제 포스트 썸네일 테스트</h2>
          <div className="space-y-4">
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '로딩 중...' : '포스트 데이터 가져오기'}
            </button>
            
            {posts.length > 0 && (
              <div className="space-y-6">
                {posts.map((post, index) => (
                  <div key={post.id} className="border p-4 bg-gray-50">
                    <h3 className="font-medium mb-2">포스트 #{index + 1}: {post.title}</h3>
                    
                    {/* 썸네일 정보 */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>썸네일 URL:</strong> {post.thumbnail || '없음'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>첨부 파일 수:</strong> {post.attachedFiles?.length || 0}
                      </p>
                    </div>
                    
                    {/* 썸네일 이미지 테스트 */}
                    {post.thumbnail && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ImageProxy 사용 */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">ImageProxy 컴포넌트</h4>
                          <ImageProxy
                            src={post.thumbnail}
                            alt={post.title}
                            className="w-full h-32 object-cover border"
                          />
                        </div>
                        
                        {/* 일반 img 태그 */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">일반 img 태그</h4>
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            className="w-full h-32 object-cover border"
                            onLoad={() => console.log(`✅ [DEBUG] 포스트 ${post.id} 썸네일 로드 성공`)}
                            onError={() => console.log(`❌ [DEBUG] 포스트 ${post.id} 썸네일 로드 실패`)}
                          />
                        </div>
                      </div>
                    )}
                    
                    {!post.thumbnail && (
                      <p className="text-gray-500 text-sm">이 포스트에는 썸네일이 없습니다.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">5. 네트워크 상태</h2>
          <div className="space-y-4">
            <button
              onClick={testS3Connection}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              S3 연결 테스트
            </button>
            
            <button
              onClick={checkS3Files}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              S3 파일 목록 확인
            </button>

            <button
              onClick={checkDbFiles}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              DB 파일 목록 확인
            </button>

            <button
              onClick={compareFiles}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              S3 vs DB 파일 비교
            </button>

            <button
              onClick={testSpecificFile}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              인코딩된 파일 테스트
            </button>

            <button
              onClick={debugPost}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              포스트 콘텐츠 디버그
            </button>
          </div>
        </section>
      </div>
    </div>
  );
} 