import type { HandleClientError } from '@sveltejs/kit';
import { remember } from '$lib/last-error';

export const handleError: HandleClientError = ({ error, message }) => {
  remember(error instanceof Error ? error.message : message);
};
