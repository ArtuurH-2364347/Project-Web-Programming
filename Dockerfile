FROM uhinf/webprogramming:2526
COPY . /website

# Remove default page from base image
RUN rm /website/public/default.html