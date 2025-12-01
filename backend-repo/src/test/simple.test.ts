import { describe, it, expect } from '@jest/globals';

describe('Simple Tests', () => {
  it('should pass basic math test', () => {
    expect(2 + 2).toBe(4);
  });

  it('should handle string operations', () => {
    const str = 'Hello World';
    expect(str.toLowerCase()).toBe('hello world');
  });

  it('should handle array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr.length).toBe(5);
    expect(arr.includes(3)).toBe(true);
  });

  it('should handle object operations', () => {
    const obj = { name: 'Test', value: 42 };
    expect(obj.name).toBe('Test');
    expect(obj.value).toBe(42);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('async result');
    const result = await promise;
    expect(result).toBe('async result');
  });

  it('should handle error cases', () => {
    expect(() => {
      throw new Error('Test error');
    }).toThrow('Test error');
  });
});










