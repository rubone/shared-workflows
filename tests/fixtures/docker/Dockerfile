# syntax=docker/dockerfile:1
# Smoke test image for docker-build-push.yml: multi-platform base, pinned by digest.
FROM busybox:1.37.0@sha256:a7dbc319b1438115a207e11930dc4bb3e643dcb3ec0bdd694bb36cd8fad289ec

ARG GREETING="Hello from the shared-workflows fixture"
ENV GREETING=${GREETING}

WORKDIR /app
COPY hello.sh .
RUN chmod 0755 hello.sh

USER 65534:65534
ENTRYPOINT ["/app/hello.sh"]
