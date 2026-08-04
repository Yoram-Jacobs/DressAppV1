import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { parseMarkdown } from '../parseMarkdown';

describe('parseMarkdown', () => {
  test('returns null for null/empty input', () => {
    expect(parseMarkdown(null)).toBeNull();
    expect(parseMarkdown('')).toBeNull();
  });

  test('renders h1, h2, h3 headings', () => {
    const result = parseMarkdown('# Hello\n## World\n### Foo');
    render(<>{result}</>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('World');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Foo');
  });

  test('renders bold text', () => {
    const result = parseMarkdown('This is **bold** text');
    render(<>{result}</>);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  test('renders inline code', () => {
    const result = parseMarkdown('Use `npm install` to start');
    render(<>{result}</>);
    expect(screen.getByText('npm install').tagName).toBe('CODE');
  });

  test('renders links', () => {
    const result = parseMarkdown('Visit [DressApp](https://dressapp.co) now');
    render(<>{result}</>);
    const link = screen.getByRole('link', { name: 'DressApp' });
    expect(link).toHaveAttribute('href', 'https://dressapp.co');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('renders bullet lists', () => {
    const result = parseMarkdown('- item one\n- item two\n- item three');
    render(<>{result}</>);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('item one');
    expect(items[1]).toHaveTextContent('item two');
    expect(items[2]).toHaveTextContent('item three');
  });

  test('renders numbered lists', () => {
    const result = parseMarkdown('1. first\n2. second\n3. third');
    render(<>{result}</>);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  test('renders blockquotes', () => {
    const result = parseMarkdown('> This is a quote');
    render(<>{result}</>);
    const blockquote = document.querySelector('blockquote');
    expect(blockquote).toHaveTextContent('This is a quote');
  });

  test('renders horizontal rules', () => {
    const result = parseMarkdown('text before\n---\ntext after');
    render(<>{result}</>);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  test('renders code blocks', () => {
    const result = parseMarkdown("```js\nconst x = 1;\n```");
    render(<>{result}</>);
    const pre = document.querySelector('pre');
    expect(pre).toHaveTextContent('const x = 1;');
  });

  test('renders pipe-delimited tables', () => {
    const result = parseMarkdown('| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |');
    render(<>{result}</>);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  test('renders paragraphs with empty line breaks', () => {
    const result = parseMarkdown('First paragraph\n\nSecond paragraph');
    render(<>{result}</>);
    expect(screen.getByText('First paragraph').tagName).toBe('P');
    expect(screen.getByText('Second paragraph').tagName).toBe('P');
  });

  test('renders mixed content', () => {
    const result = parseMarkdown('# Title\n\nSome **bold** text with `code`.\n\n- list item\n\n> quote');
    render(<>{result}</>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    const blockquote = document.querySelector('blockquote');
    expect(blockquote).toHaveTextContent('quote');
  });
});
