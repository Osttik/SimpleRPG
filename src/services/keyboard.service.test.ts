import { describe, expect, it } from 'vitest';
import { isEditableKeyboardTarget } from './keyboard.service';

describe('keyboard shortcut targeting', () => {
  it('treats translated form controls as text-editing targets', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(textarea)).toBe(true);
    expect(isEditableKeyboardTarget(select)).toBe(true);
    expect(isEditableKeyboardTarget(editable)).toBe(true);
  });

  it('allows shortcuts on disabled or read-only controls and normal buttons', () => {
    const disabledInput = document.createElement('input');
    disabledInput.disabled = true;
    const readOnlyInput = document.createElement('input');
    readOnlyInput.readOnly = true;
    const button = document.createElement('button');

    expect(isEditableKeyboardTarget(disabledInput)).toBe(false);
    expect(isEditableKeyboardTarget(readOnlyInput)).toBe(false);
    expect(isEditableKeyboardTarget(button)).toBe(false);
  });
});
