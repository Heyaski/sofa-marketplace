# Конфигурация Gunicorn для продакшена
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
# Увеличиваем таймаут для загрузки очень больших файлов до 200GB (4 часа)
# 200GB файлы могут загружаться часами, поэтому нужен большой таймаут
timeout = 14400  # 4 часа (в секундах)
graceful_timeout = 14400  # 4 часа для graceful shutdown
keepalive = 5
# user и group не нужны, так как systemd уже запускает от имени deploy
# user = "deploy"
# group = "deploy"
pidfile = "/home/deploy/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/deploy/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
loglevel = "info"

