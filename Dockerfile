FROM uhinf/webprogramming:2526

# Copy all project files into container
COPY . /website

COPY public/index.html /website/public/default.html

WORKDIR /website/public
