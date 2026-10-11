import Settings from "../models/Settings.js";

// Lazily creates the single settings document on first access — no seed
// script needed, and every field falls back to its schema default.
// Exported so payment.controller.js can reuse it for the advance-payment
// percentage, rather than duplicating the get-or-create logic.
export const getOrCreateSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
};

export const getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const {
      businessName,
      tagline,
      contactEmail,
      contactPhone,
      address,
      policyNotes,
      advancePaymentPercentage,
    } = req.body;

    if (businessName !== undefined) settings.businessName = businessName;
    if (tagline !== undefined) settings.tagline = tagline;
    if (contactEmail !== undefined) settings.contactEmail = contactEmail;
    if (contactPhone !== undefined) settings.contactPhone = contactPhone;
    if (address !== undefined) settings.address = address;
    if (policyNotes !== undefined) settings.policyNotes = policyNotes;
    if (advancePaymentPercentage !== undefined) settings.advancePaymentPercentage = advancePaymentPercentage;

    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// Public subset shown across the customer-facing site (name, contact,
// policies, advance %). Everything else stays owner-only.
export const getPublicSettings = async (req, res, next) => {
  try {
    const s = await getOrCreateSettings();
    res.json({
      success: true,
      data: {
        businessName: s.businessName,
        tagline: s.tagline,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        address: s.address,
        policyNotes: s.policyNotes,
        advancePaymentPercentage: s.advancePaymentPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};
