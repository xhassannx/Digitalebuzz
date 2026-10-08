// Simple test to diagnose the issue (ES modules version)
import http from 'http';

console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server works!\n');
});

// Try basic listen without host parameter (most compatible)
console.log('\nAttempting to start server on port 3000...');

server.listen(3000, () => {
  console.log('✅ SUCCESS! Server running at http://localhost:3000/');
  console.log('Press Ctrl+C to stop');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  process.exit(1);
});
