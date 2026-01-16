# Contributing to Review to Instruction

Thank you for your interest in contributing! 🎉

## Ways to Contribute

### 1. Demo Materials (High Priority)

We need demo screenshots and GIFs for the README:
- See [docs/images/README.md](./docs/images/README.md) for requirements
- Submit via PR with images in `docs/images/` directory

### 2. Bug Reports

Found a bug? Please open an issue with:
- Chrome version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console logs (if applicable)

### 3. Feature Requests

Have an idea? Open an issue describing:
- Use case
- Expected behavior
- Why it would be valuable

### 4. Code Contributions

#### Setup

```bash
git clone https://github.com/sunio00000/review-to-instruction.git
cd review-to-instruction
npm install
npm run dev
```

#### Commit Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Add or update tests
- `chore:` - Build/config changes

#### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Make your changes
4. Test locally: `npm run build` and load in Chrome
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feat/amazing-feature`
7. Open a Pull Request

## Development Guidelines

- Write TypeScript (avoid `any` types)
- Follow existing code style
- Add comments for complex logic
- Test manually before submitting PR
- Keep PRs focused (one feature/fix per PR)

## Questions?

Open a [GitHub Discussion](https://github.com/sunio00000/review-to-instruction/discussions) or comment on existing issues.

---

**Thank you for contributing!** 🙏
