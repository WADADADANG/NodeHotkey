/**
 * docs/CLOUDFLARE_WORKER_API.js
 * Cloudflare Worker API for NodeHotkey Community Hub & Profile Workshop
 * Connected to Cloudflare D1 SQL Database: `nodehotkey-community`
 * 
 * Routes:
 * 1. GET /api/profiles -> Search, sort, and list profiles (with tags/search)
 * 2. GET /api/profiles/:id -> Download profile data (increments downloads_count unless ?preview=1)
 * 3. POST /api/profiles -> Share new profile or update existing profile (secured by author_secret)
 * 4. POST /api/profiles/delete -> Delete profile (secured by author_secret)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // ตั้งค่า CORS ให้ NodeHotkey เรียกใช้งานได้จากทุกเครื่อง
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. ค้นหาและดึงรายการโปรไฟล์ทั้งหมดใน Community
      if (pathname === '/api/profiles' && request.method === 'GET') {
        const q = searchParams.get('q') || '';
        const sort = searchParams.get('sort') || 'downloads';
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

        let query = `
          SELECT id, profile_name, author_id, author_name, description, tags, downloads_count, likes_count, version, created_at, updated_at
          FROM profiles
        `;
        const params = [];

        if (q) {
          query += ` WHERE profile_name LIKE ? OR description LIKE ? OR tags LIKE ? OR author_name LIKE ?`;
          const searchTerm = `%${q}%`;
          params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (sort === 'recent') {
          query += ` ORDER BY updated_at DESC LIMIT ?`;
        } else {
          query += ` ORDER BY downloads_count DESC, updated_at DESC LIMIT ?`;
        }
        params.push(limit);

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify({ success: true, profiles: results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. ดึงข้อมูลตัวโปรไฟล์เพื่อนำไปติดตั้งลงเครื่อง (พร้อมนับยอดดาวน์โหลด +1 หากไม่ใช่ preview)
      if (pathname.startsWith('/api/profiles/') && pathname !== '/api/profiles/delete' && request.method === 'GET') {
        const id = pathname.replace('/api/profiles/', '').trim();
        const profile = await env.DB.prepare(`SELECT * FROM profiles WHERE id = ?`).bind(id).first();

        if (!profile) {
          return new Response(JSON.stringify({ success: false, error: 'Profile not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // เช็คว่าถ้าเป็นโหมด Preview จะไม่นับยอดดาวน์โหลด
        const isPreview = searchParams.get('preview') === '1' || searchParams.get('preview') === 'true';
        if (!isPreview) {
          ctx.waitUntil(
            env.DB.prepare(`UPDATE profiles SET downloads_count = downloads_count + 1 WHERE id = ?`).bind(id).run()
          );
        }

        delete profile.author_secret; // ซ่อน Secret ไม่ส่งออกไปให้คนอื่นเห็น
        return new Response(JSON.stringify({ success: true, profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. อัปโหลดโปรไฟล์ขึ้น หรืออัปเดตเวอร์ชันเดิม (เช็ค Secret เจ้าของ)
      if (pathname === '/api/profiles' && request.method === 'POST') {
        const body = await request.json();
        const {
          id,
          profile_name,
          author_id,
          author_name,
          author_secret,
          description = '',
          tags = '',
          profile_data,
          version = '1.0.0'
        } = body;

        if (!profile_name || !author_id || !author_secret || !profile_data) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const targetId = id || `prf_${crypto.randomUUID().slice(0, 12)}`;
        const existing = await env.DB.prepare(`SELECT author_id, author_secret FROM profiles WHERE id = ?`).bind(targetId).first();

        if (existing) {
          // ตรวจสอบสิทธิ์: ถ้า Secret ไม่ตรงกับคนสร้างเดิม ห้ามบันทึกทับ
          if (existing.author_secret !== author_secret) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized: คุณไม่ใช่เจ้าของโปรไฟล์นี้ ไม่สามารถแก้ไขทับได้' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          await env.DB.prepare(`
            UPDATE profiles 
            SET profile_name = ?, author_name = ?, description = ?, tags = ?, profile_data = ?, version = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(profile_name, author_name, description, tags, JSON.stringify(profile_data), version, targetId).run();

          return new Response(JSON.stringify({ success: true, id: targetId, message: 'Profile updated successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          await env.DB.prepare(`
            INSERT INTO profiles (id, profile_name, author_id, author_name, author_secret, description, tags, profile_data, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(targetId, profile_name, author_id, author_name, author_secret, description, tags, JSON.stringify(profile_data), version).run();

          return new Response(JSON.stringify({ success: true, id: targetId, message: 'Profile published successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 4. ลบโปรไฟล์ออกจาก Community (เช็ค Secret เจ้าของ)
      if ((pathname === '/api/profiles/delete' && request.method === 'POST') ||
          (pathname.startsWith('/api/profiles/') && request.method === 'DELETE')) {
        let targetId = '';
        let secret = '';

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          targetId = body.id;
          secret = body.author_secret;
        } else {
          targetId = pathname.replace('/api/profiles/', '').trim();
          const auth = request.headers.get('Authorization') || '';
          secret = auth.replace('Bearer ', '').trim();
        }

        if (!targetId || !secret) {
          return new Response(JSON.stringify({ success: false, error: 'Missing profile id or author secret' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existing = await env.DB.prepare(`SELECT author_secret FROM profiles WHERE id = ?`).bind(targetId).first();
        if (!existing) {
          return new Response(JSON.stringify({ success: false, error: 'Profile not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (existing.author_secret !== secret) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized: คุณไม่ใช่เจ้าของโปรไฟล์นี้ ไม่สามารถลบได้' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await env.DB.prepare(`DELETE FROM profiles WHERE id = ?`).bind(targetId).run();

        return new Response(JSON.stringify({ success: true, message: 'Deleted profile successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
};
