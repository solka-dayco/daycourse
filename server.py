import http.server, socketserver, os

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/' or path == '':
            self.path = '/index.html'
        elif '.' not in os.path.basename(path):
            self.path = path.rstrip('/') + '.html'
        return super().do_GET()

import webbrowser
webbrowser.open('http://localhost:8080')
with socketserver.TCPServer(('', 8080), Handler) as httpd:
    httpd.serve_forever()