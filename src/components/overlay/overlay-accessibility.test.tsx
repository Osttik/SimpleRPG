import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CoreOverlay, isOverlayOpen } from '.';

function ControlledOverlay() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setVisible(true)}>Open overlay</button>
      <CoreOverlay
        visible={visible}
        setVisible={setVisible}
        title="Translated Inventory"
        closeLabel="Close overlay"
        content={<button type="button">First translated action</button>}
      />
    </>
  );
}

describe('CoreOverlay accessibility behavior', () => {
  it('labels translated overlays, traps initial focus, and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(<ControlledOverlay />);

    const opener = screen.getByRole('button', { name: 'Open overlay' });
    await user.click(opener);

    expect(isOverlayOpen()).toBe(true);
    expect(screen.getByText('Translated Inventory')).toHaveClass('sr-only');

    const firstAction = await screen.findByRole('button', { name: 'First translated action' });
    await waitFor(() => expect(firstAction).toHaveFocus());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(isOverlayOpen()).toBe(false));
    expect(opener).toHaveFocus();
  });
});
