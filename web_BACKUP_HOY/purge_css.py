import re

def purge_local_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Capturar TODOS los <style> blocks
    style_blocks = re.findall(r'(<style[^>]*>)(.*?)(</style>)', content, re.DOTALL)

    if not style_blocks:
        return

    selectors_to_remove = [
        r'#header-login-btn',
        r'\.account-btn',
        r'\.account-menu',
        r'\.account\b',
        r'\.lang-btn',
        r'\.header\b(?!-top|-bottom|-actions)',
    ]

    def remove_rules(css):
        # Rompe en bloques de reglas CSS
        rules = re.findall(r'[^}]+\}', css, re.DOTALL)
        cleaned_rules = []

        for rule in rules:
            if not any(re.search(sel, rule) for sel in selectors_to_remove):
                cleaned_rules.append(rule)

        return '\n'.join(cleaned_rules)

    new_content = content

    for full_match in re.finditer(r'(<style[^>]*>)(.*?)(</style>)', content, re.DOTALL):
        open_tag, css_content, close_tag = full_match.groups()

        cleaned_css = remove_rules(css_content)

        new_block = open_tag + cleaned_css + close_tag

        new_content = new_content.replace(full_match.group(0), new_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Purged CSS from {file_path}")


purge_local_css('/Users/djmago/Desktop/miami-dj-beat-platform/web/account-profile.html')
purge_local_css('/Users/djmago/Desktop/miami-dj-beat-platform/web/account-settings.html')
