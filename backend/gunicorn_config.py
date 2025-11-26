# Конфигурация Gunicorn для продакшена
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
# user и group не нужны, так как systemd уже запускает от имени deploy
# user = "deploy"
# group = "deploy"
pidfile = "/home/deploy/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/deploy/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
loglevel = "info"

