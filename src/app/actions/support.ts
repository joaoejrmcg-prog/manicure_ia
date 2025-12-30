'use server';

export async function sendSupportMessage(formData: FormData) {
    const subject = formData.get('subject');
    const message = formData.get('message');

    // Simular delay de envio
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('--- MOCK EMAIL SEND ---');
    console.log('Subject:', subject);
    console.log('Message:', message);
    console.log('-----------------------');

    return { success: true };
}
