FROM nginx:alpine
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY proxy_params /etc/nginx/proxy_params
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
