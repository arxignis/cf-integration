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

	const captchaHTML = `<!DOCTYPE html>
  <html>
  <head>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
      <title>Captcha</title>
      <style>
          html,
          body {
              height: 100%;
              margin: 0;
          }

          .container {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
          }

          .centered-form {
              max-width: 400px;
              padding: 20px;
              background-color: #f0f0f0;
              border-radius: 8px;
          }
      </style>
  </head>

  <body>
      <div class="container">
          <form action="?" method="POST" class="centered-form", id="captcha-form">
              <div class="cf-turnstile" data-sitekey="${siteKey}" id="container"></div>
              <br />
          </form>
      </div>
  </body>

  <script>
    // if using synchronous loading, will be called once the DOM is ready
    turnstile.ready(function () {
        turnstile.render('#container', {
            sitekey: '${siteKey}',
            callback: function(token) {
              const xhr = new XMLHttpRequest();
              xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                  window.location.reload()
                }
              };
              const form = document.getElementById("captcha-form");
              xhr.open(form.method, "./");
              xhr.send(new FormData(form));
            },
        });
    });
  </script>
  </html>`;

	return new Response(captchaHTML, {
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
	if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
		return new Response('Unsupported Content-Type. Expected multipart/form-data or application/x-www-form-urlencoded', {
			status: 400,
		});
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
		newResponse.headers.set('Set-Cookie', `ax_captcha=${jwtToken}; Path=/; HttpOnly; Secure; SameSite=Strict;`);
		newResponse.headers.set('Location', request.url);
		return newResponse;
	}
}
