import fs from 'node:fs';
import http from 'node:http';
import {argv} from 'node:process';

const PORT = 3001;

const fileInput = argv[2];

http
  .createServer((req, res) => {
    if (req.url === '/state') {
      res.writeHead(200, {'Content-Type': 'application/json'});

      const fileStream = fs.createReadStream(fileInput);

      fileStream.pipe(res);
      return;
    }

    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
  })
  .listen(PORT);

console.log(`Server running at port ${PORT}`);
