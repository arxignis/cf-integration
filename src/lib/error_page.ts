interface ErrorPageProps {
	errorCode: number;
	errorTitle: string;
	errorMessage: string;
	userIPAddress: string;
	originalUrl: string;
	timestamp: string;
	requestId: string;
	ray: string;
}

export const htmlErrorPage = (props: ErrorPageProps) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${props.errorCode} - ${props.errorTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }

        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 3rem;
            text-align: center;
            max-width: 500px;
            width: 90%;
            margin: 2rem;
        }

        .error-code {
            font-size: 6rem;
            font-weight: 700;
            color: #e74c3c;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .error-title {
            font-size: 1.8rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 1rem;
        }

        .error-message {
            font-size: 1.1rem;
            color: #7f8c8d;
            line-height: 1.6;
            margin-bottom: 2rem;
        }

        .actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-block;
        }

        .btn-primary {
            background: #3498db;
            color: white;
        }

        .btn-primary:hover {
            background: #2980b9;
            transform: translateY(-2px);
        }

        .btn-secondary {
            background: #ecf0f1;
            color: #2c3e50;
        }

        .btn-secondary:hover {
            background: #bdc3c7;
            transform: translateY(-2px);
        }

        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            color: #e74c3c;
        }

        .error-details {
            font-size: 0.9rem;
            color: #95a5a6;
            line-height: 1.5;
            margin-bottom: 2rem;
            text-align: left;
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid #3498db;
        }

        .footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #ecf0f1;
            text-align: center;
        }

        .footer p {
            font-size: 0.9rem;
            color: #7f8c8d;
            margin: 0;
        }

        .footer a {
            color: #3498db;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .footer a:hover {
            color: #2980b9;
            text-decoration: underline;
        }

        @media (max-width: 480px) {
            .container {
                padding: 2rem;
                margin: 1rem;
            }

            .error-code {
                font-size: 4rem;
            }

            .error-title {
                font-size: 1.5rem;
            }

            .actions {
                flex-direction: column;
            }

            .error-details {
                font-size: 0.8rem;
                padding: 0.75rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <div class="error-code">${props.errorCode}</div>
        <h1 class="error-title">${props.errorTitle}</h1>
        <p class="error-message">
            ${props.errorMessage}
        </p>
        <p class="error-details">
            <strong>Original URL:</strong> ${props.originalUrl}
            <br>
            <strong>ip:</strong> ${props.userIPAddress}
            <br>
            <strong>Timestamp:</strong> ${props.timestamp}
						<br>
						<strong>Cloudflare Request ID:</strong> ${props.requestId}
						<br>
						<strong>Cloudflare X-Ray:</strong> ${props.ray}
        </p>
        <div class="footer">
            <p>Powered by <a href="https://arxignis.com">Arxignis</a></p>
        </div>
    </div>
</body>
</html>
`;

export const jsonErrorPage = (props: ErrorPageProps) => {
	return {
		errorCode: props.errorCode,
		errorTitle: props.errorTitle,
		errorMessage: props.errorMessage,
		userIPAddress: props.userIPAddress,
		originalUrl: props.originalUrl,
		timestamp: props.timestamp,
		requestId: props.requestId,
		ray: props.ray,
	};
};

export const externalErrorPage = async (url: string) => {
	const response = await fetch(url, {
		method: "GET",
	});
	return response.text();
};

export const getErrorPage = (props: ErrorPageProps, type: "html" | "json" | "external") => {
	switch (type) {
		case "html":
			return htmlErrorPage(props);
		case "json":
			return jsonErrorPage(props);
		case "external":
			return externalErrorPage(props.originalUrl);
	}
};
