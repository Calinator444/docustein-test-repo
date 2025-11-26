import frontmatter
from server import mcp
from utils.file_reader import list_files
from os import path
import yaml
from datetime import datetime, timezone

ROOT_DIR = "../../content/posts"

def get_iso_datetime():
    now = datetime.now(timezone.utc)
    return now.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

@mcp.tool()
def get_blog_description(file_path):
    """Reads a blog post by file name and returns it's title and description as a string"""
    with open(file_path, "r", encoding="utf-8") as f:
        file_contents = frontmatter.load(f)
        seo = file_contents["seo"]
        output = ""
        for key in seo.keys():
            output += f"{key}: {seo[key]}\n"
        return output
    
@mcp.tool()
def list_blog_files():
    """Returns a list of all markdown files containing blog posts"""
    blog_files = list_files(ROOT_DIR)
    blog_files = filter(lambda x: x.endswith(".md"), blog_files)
    return blog_files

@mcp.tool()
def create_blog_post(slug: str, title: str, description: str, body: str):
    """Creates a new blog post and writes it to a file, the body must be in markdown format DO NOT INCLUDE THE FRONTMATTER OR TITLE IN THE BODY"""
    meta = {
        "title": title,
        "heroImg": "/uploads/posts/learning-about-markdown.webp",
        "author": "content/authors/napoleon.md",
        "exerpt": description,
        "date": get_iso_datetime(),
    }
    file_path = path.join(ROOT_DIR, f"{slug}.mdx")
    # Write YAML front matter and body
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("---\n")
        yaml.dump(meta, f, allow_unicode=True)
        f.write("---\n\n")
        f.write(body)


