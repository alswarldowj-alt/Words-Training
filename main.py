import http.server
import socketserver
import webbrowser
import mimetypes
import os
import sys
from socketserver import ThreadingMixIn

# === 1. 配置 ===
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# === 2. MIME 类型设置 ===
# 极其重要：如果浏览器不把 .tsx 当作 JS，Babel 就无法工作
mimetypes.init()
mimetypes.add_type('application/javascript', '.ts')
mimetypes.add_type('application/javascript', '.tsx')
mimetypes.add_type('application/json', '.json')


class ThreadedHTTPServer(ThreadingMixIn, socketserver.TCPServer):
    """处理并发请求，防止服务器卡死"""
    daemon_threads = True


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # 允许跨域并完全禁用缓存，确保代码更新立即生效
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # 如果访问根目录，确保返回 index.html
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()


# === 3. 运行服务器 ===
def start_game_server():
    os.chdir(DIRECTORY)

    print("\n" + "=" * 60)
    print("🎨 儿童英语单词学习游戏 (Word Match Adventure)")
    print(f"🏠 运行目录: {DIRECTORY}")
    print(f"🌐 访问地址: http://localhost:{PORT}")
    print("=" * 60 + "\n")

    # 自动打开浏览器
    try:
        webbrowser.open(f"http://localhost:{PORT}")
    except:
        pass

    try:
        with ThreadedHTTPServer(("", PORT), GameHandler) as httpd:
            print("🚀 服务器已启动！正在监听请求...")
            print("💡 如果页面显示空白，请在浏览器中按 F12 查看控制台报错。")
            print("🛑 按 Ctrl+C 可以停止服务器。\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已安全关闭。")
    except Exception as e:
        print(f"❌ 启动失败，原因: {e}")
        print("💡 可能是端口被占用，请尝试关闭其他 Python 运行窗口。")


if __name__ == "__main__":
    start_game_server()
