const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer();
server.on('clientError', (err, socket) => {
	console.log("[server clientError]"); 
});
server.on('close', () => {
	console.log("[server close]"); 
});
server.on('connect', (request, socket, head) => {
	console.log("[connect]"); 
	console.log(head); 
});
server.on('connection', (socket) => {
	console.log("[server connection]"); 
	//console.log(socket); 
});
server.on('request', (request, response) => {
	request.on('error', (err) => {
    	console.log("     [request error]");
		console.error(err);
	 	response.statusCode = 400;
	  	response.end();
	});
	response.on('error', (err) => {
		console.log("     [response error]");
		console.error(err);
	});

	console.log("[server request]"); // access 로그를 추가하면 되겠군.
	console.log(request.headers);
	console.log(request.httpVersion);
	console.log(request.method);
	console.log(request.url);
	if( request.method==='GET' && request.url==='/echo'){
		let body = [];
		request.on('data', (chunk)=>{
	    	console.log("     [request data]");
	    	console.log(chunk);
			body.push(chunk);
		}).on('end', () => {
	    	console.log("     [request end]");
			body = Buffer.concat(body).toString();
			response.end(body);
		});
	}else{
		var ip   = request.socket.remoteAddress;
		var port = request.socket.remotePort;


		const {headers, method, url } = request;
		let body=[];
		request.on('data', (chunk)=>{
	    	console.log("     [request data]");
	    	console.log(chunk);
			body.push(chunk);
		}).on('end', () => {
	    	console.log("     [request end]");
			body = Buffer.concat(body).toString();
		 	response.statusCode = 200;
		  	response.setHeader('Content-Type', 'application/json');
		  	const responseBody = {headers, method, url, body, ip, port};
		  	response.write(JSON.stringify(responseBody))
		  	response.end();
		});
	}
});
server.on('upgrade', (request, socket, head) => {
	console.log("[server upgrade]"); 
});
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});