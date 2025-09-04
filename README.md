#  Sticky Todo Notes 📝

An intuitive sticky notes application built with vanilla JavaScript. Create, customize, and manage your notes with easy management system.

[Live Demo](https://sticky-todo-notes.netlify.app) 🚀



### Note Management.
- ➕ Enter text to create notes
- 🖱️ Click on a note to edit content.
- ↘️ Resize notes from corner.
- 🖐️ Hold a note and drag it around to reposition it.
- 🖐️ drag mutliple notes together by highliting an  area with the mouse where the notes are, then drag them together.



## 🚀 Quick Start

1. Clone the repository:
```bash
git clone https://github.com/majd-karoun/sticky-todo-notes.git
```

2. Open in your preferred browser:
```bash
cd sticky-todo-notes
open index.html
```


## 🛠️ Technical Stack

- HTML5
- CSS3
- JavaScript
- LocalStorage for persistent data


## ⚙️ Customization

### Color Palette
```javascript
const colors = [
    '#ffd700', // Yellow
    '#ff7eb9', // Pink
    '#7afcff', // Cyan
    // ... add your colors
];
```

### Board Styles
- Multiple background colors
- Pattern options: None, Dots, Grid, Lines

### Animation Timing
```css
:root {
    --animation-speed: 0.3s;
    --hold-delay: 150ms;
}
```


## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open a pull request

