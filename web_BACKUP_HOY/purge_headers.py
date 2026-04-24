import re

def purge_local_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to remove all local <style> blocks that target header elements.
    # Actually, we can just surgically remove the known selectors from the `<style>` block.
    # The selectors are:
    # #header-login-btn
    # .account-btn, .account-btn .avatar, .account-btn .caret
    # .account, .account-menu, .account-menu.open, .account-menu a, .account-menu a:hover
    # .lang-btn, .lang-btn.active, .lang-btn:hover
    # .header
    
    # Let's completely extract the `<style>` block, parse out those specific rules, and rewrite it.
    style_match = re.search(r'(<style[^>]*>)(.*?)(</style>)', content, re.DOTALL)
    if not style_match:
        return

    style_tag_open = style_match.group(1)
    css_content = style_match.group(2)
    style_tag_close = style_match.group(3)

    # Regex to match a CSS rule block by selector prefix
    # e.g., r'\n\s*#header-login-btn\b[^\{]*\{[^\}]*\}'
    selectors_to_remove = [
        r'#header-login-btn\b',
        r'\.account-btn\b',
        r'\.account\b',
        r'\.account-menu\b',
        r'\.lang-btn\b',
        r'\.header\b(?!-top|-bottom|-actions)', # Match .header strictly
    ]

    new_css = css_content
    for sel in selectors_to_remove:
        # Match selector, any pseudo/descendants, {, until }, then optional whitespace
        pattern = r'(\n[ \t]*)?' + sel + r'[^\{]*\{[^\}]*\}'
        new_css = re.sub(pattern, '', new_css, flags=re.MULTILINE)

    # Some rules might have multiple selectors comma-separated, the above pattern is slightly greedy or might miss them if they are the second selector.
    # Since these are usually single-selector blocks in the local files:
    
    # Replace back
    new_style_block = style_tag_open + new_css + style_tag_close
    content = content.replace(style_match.group(0), new_style_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Purged CSS from {file_path}")

purge_local_css('/Users/djmago/Desktop/miami-dj-beat-platform/web/account-profile.html')
purge_local_css('/Users/djmago/Desktop/miami-dj-beat-platform/web/account-settings.html')
