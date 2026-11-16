FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/hitel-api/requirements.txt /tmp/hitel-requirements.txt
RUN pip install --no-cache-dir -r /tmp/hitel-requirements.txt \
 && groupadd --system hitel && useradd --system --gid hitel --home-dir /app hitel \
 && mkdir -p /app/data && chown -R hitel:hitel /app
COPY services/hitel-api/app /app/app
USER hitel
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3).read()" || exit 1
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips","*"]
