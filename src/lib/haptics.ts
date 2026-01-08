import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Provides a light haptic impact (perfect for button taps)
 */
export const hapticLight = async () => {
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
        // Fail silently if not on a mobile device
    }
};

/**
 * Provides a medium haptic impact (perfect for significant actions)
 */
export const hapticMedium = async () => {
    try {
        await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
        // Fail silently
    }
};

/**
 * Provides a success haptic notification
 */
export const hapticSuccess = async () => {
    try {
        await Haptics.notification({ type: 'SUCCESS' as any });
    } catch (e) {
        // Fail silently
    }
};
