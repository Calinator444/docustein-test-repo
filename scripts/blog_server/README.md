### Description

This is an MCP tool for generating blog posts that match the Tina starter used as the base of this project.

### Prerequesites
1. Python
2. uv
3. Claude Desktop

### Setup 

1. run uv sync

2. Locate your `claude_desktop_config.json` (usually located at `~/Users/<your-user>/Library/Application Support/Claude/claude_desktop_config.json` for mac users)

3. Add the following to the `mcpServers` property. If the property doesn't exist then add one

```json
{
    "mcpServers": {
        "BlogGenerator": { 
        "command": "/Users/<your-user>/.local/bin/uv",
        "args": [
            "--directory",
            "/Users/<your-user>/<path-to-scripts>/scripts/blog_server",
            "run",
            "main.py"
            ]
        }
    }
}
```


4. Ensure that `BlogGenerator` appears in your tool list when locating Claude destktop
