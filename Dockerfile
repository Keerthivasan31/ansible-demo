# Use Ubuntu as base
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y python3 python3-pip ansible

# Copy project files into container
WORKDIR /app
COPY . /app

# Default command
CMD ["ansible-playbook", "site.yml"]
