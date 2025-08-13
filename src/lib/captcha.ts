import jwt from '@tsndr/cloudflare-worker-jwt';
import { parse } from 'cookie';

export const captcha = async (request: Request, env: Env) => {
  const siteKey = env.TURNSTILE_SITE_KEY;
  const secretKey = env.TURNSTILE_SECRET_KEY;
  const ip = request.headers.get('CF-Connecting-IP');
  const cookie = parse(request.headers.get('Cookie') || '');
  if (cookie['ax_captcha'] !== undefined) {
    console.log('captchaAuth cookie is present');
    try {
      const isValid = await jwt.verify(cookie['ax_captcha'], secretKey + ip);
      if (isValid) {
        return fetch(request);
      }
    } catch (err) {
      console.log(err);
    }
    console.log('jwt is invalid');
  }

  if (request.method === 'POST') {
    return handlePost(request, env);
  }

  const captchaResponse = await env.ASSETS.fetch(
    new URL('captcha.html', request.url)
  );
  const captchaHTML = await captchaResponse.text();

  // Replace template variables
  const processedHTML = captchaHTML
    .replace(/\${siteKey}/g, siteKey)
    .replace(/\${requestUrl}/g, request.url);

  return new Response(processedHTML, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
    status: 200,
  });
};

interface TurnstileResponse {
  success: boolean;
  error_codes?: string[];
}

async function handlePost(request: Request, env: Env) {
  // Check if the request has a compatible Content-Type for FormData parsing
  const contentType = request.headers.get('content-type') || '';
  if (
    !contentType.includes('multipart/form-data') &&
    !contentType.includes('application/x-www-form-urlencoded')
  ) {
    return new Response(
      'Unsupported Content-Type. Expected multipart/form-data or application/x-www-form-urlencoded',
      {
        status: 400,
      }
    );
  }

  const body = await request.formData();
  const token = body.get('cf-turnstile-response');
  const ip = request.headers.get('CF-Connecting-IP');
  let formData = new FormData();
  const secretKey = env.TURNSTILE_SECRET_KEY;
  formData.append('secret', secretKey as string);
  formData.append('response', token as string);
  formData.append('remoteip', ip as string);
  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const result = await fetch(url, {
    body: formData,
    method: 'POST',
  });
  const outcome = (await result.json()) as TurnstileResponse;
  if (!outcome.success) {
    console.info('Invalid captcha solution');
    return new Response('Invalid captcha solution', {
      status: 401,
    });
  } else {
    console.debug('Valid captcha solution;', 'Issuing JWT token');
    const jwtToken = await jwt.sign(
      {
        data: 'captcha solved',
        exp: Math.floor(Date.now() / 1000) + 2 * (60 * 60), // 2 hours
      },
      secretKey + ip
    );
    const newResponse = new Response(null, {
      status: 302,
    });
    newResponse.headers.set(
      'Set-Cookie',
      `ax_captcha=${jwtToken}; Path=/; HttpOnly; Secure; SameSite=Strict;`
    );
    newResponse.headers.set('Location', request.url);
    return newResponse;
  }
}
