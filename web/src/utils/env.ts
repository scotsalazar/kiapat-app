export const isDemoMode = (): boolean => import.meta.env.VITE_DEMO_MODE === 'true';

export default isDemoMode;
