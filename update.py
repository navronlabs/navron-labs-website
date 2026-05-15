import os

for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace email
            content = content.replace('Email: navronlabs@gmail.com', 'Email: <span class="dynamic-email">navronlabs@gmail.com</span>')
            content = content.replace('<p style="color: var(--color-text-muted);">navronlabs@gmail.com</p>', '<p style="color: var(--color-text-muted);" class="dynamic-email">navronlabs@gmail.com</p>')
            
            # Replace phone
            content = content.replace('Phone: +91 7644904831', 'Phone: <span class="dynamic-phone">+91 7644904831</span>')
            content = content.replace('<p style="color: var(--color-text-muted);">+91 7644904831</p>', '<p style="color: var(--color-text-muted);" class="dynamic-phone">+91 7644904831</p>')
            
            # Replace tagline
            content = content.replace('<p>Empowering Businesses Online</p>', '<p class="dynamic-tagline">Empowering Businesses Online</p>')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

print('Updated HTML classes')
