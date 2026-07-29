import React, { useState, useEffect } from 'react';
import { Button, Card, Alert, Spinner, Table } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Pricing = () => {
  const [pricingData, setPricingData] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch comprehensive pricing information and quota status on mount
  useEffect(() => {
    const fetchPricingData = async () => {
      try:
        // Get comprehensive pricing info
        const pricingRes = await axios.get('/api/v1/pricing/info');
        setPricingData(pricingRes.data);
        
        // Get quota status
        const quotaRes = await axios.get('/api/v1/quota/status');
        setQuotaStatus(quotaRes.data);
      catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError('Failed to load pricing information. Please try again later.');
      finally:
        setLoading(false);
      };
    };

    fetchPricingData();
  }, []);

  // Refresh quota status periodically (every 30 seconds) to show real-time updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try:
        const quotaRes = await axios.get('/api/v1/quota/status');
        setQuotaStatus(quotaRes.data);
      catch (err) {
        console.warn('Failed to refresh quota status:', err);
      }, 30000;
    });

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span>Loading pricing information...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mt-4">
        {error}
      </Alert>
    );
  }

  // Determine display state based on quota status
  let quotaMessage = '';
  let quotaVariant = 'success';
  let needsPurchaseLink = false;

  switch (quotaStatus.status) {
    case 'soft_warning':
      quotaMessage = quotaStatus.message || 'You are approaching your credit limit.';
      quotaVariant = 'warning';
      needsPurchaseLink = true;
      break;
    case 'hard_limit':
      quotaMessage = quotaStatus.message || 'Your allocated credits have been exhausted.';
      quotaVariant = 'danger';
      needsPurchaseLink = true;
      break;
    case 'exhausted':
      quotaMessage = quotaStatus.message || 'No credits available. Purchase more to continue using AI features.';
      quotaVariant = 'danger';
      needsPurchaseLink = true;
      break;
    default:
      quotaMessage = 'All set! You have sufficient credits for AI operations.';
      quotaVariant = 'success';
  }

  return (
    <div className="pricing-page">
      <h1 className="mb-4">Pricing & Credit Plan</h1>
      
      {/* Quota Status Banner - The key in-app messaging component */}
      <Alert 
        variant={quotaVariant} 
        className="mb-4 fade show"
        dismissible
      >
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <strong>{quotaStatus.status === 'soft_warning' ? 'Running Low' : 
                     quotaStatus.status === 'hard_limit' ? 'Credits Exhausted' : 
                     quotaStatus.status === 'exhausted' ? 'No Credits' : 'All Set'}!</strong>
            <p className="mb-0 mt-2">{quotaMessage}</p>
          </div>
          {needsPurchaseLink && (
            <Link to="/pricing/purchase" className="btn btn-sm btn-outline-light ms-3">
              Purchase More Credits &gt;
            </Link>
          )}
        </div>
      </Alert>

      {/* Plan Comparison Cards */}
      <div className="row mb-5">
        {pricingData?.pricing_tiers.map((tier) => (
          <div className="col-md-4 mb-4" key={tier.name}>
            <Card className="h-100" border={tier.name === 'Pro' ? 'primary' : 'light'}>
              <Card.Body>
                <Card.Title className="text-center">{tier.name} Plan</CardTitle>
                <Card.Text className="text-center text-muted">
                  ${(tier.price / 100).toFixed(2)}/mo <small>({((tier.price / 100) * 0.8).toFixed(2)}/yr annual)</small>
                </CardText>
                <hr />
                <ul className="list-unstyled mb-4">
                  <li>✅ <strong>{tier.credits} AI credits/mo</strong></li>
                  <li>✅ Daily limit: {tier.ai_daily_limit}</li>
                  <li>✅ Monthly limit: {tier.ai_monthly_limit}</li>
                  {tier.features.map((feature, i) => (
                    <li key={i}>✓ {feature}</li>
                  ))}
                </ul>
                <Link to="/subscription/upgrade" className={`btn btn-${tier.name === 'Pro' ? 'primary' : 'secondary'} w-100`}>
                  {pricingData.current_plan === tier.name ? 'Your Plan' : 'Select This Plan'}
                </Link>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>

      {/* Current Credit Breakdown */}
      <section className="mb-5">
        <h2>Your Current Credits</h2>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Credit Type</th>
              <th>Available</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Paid Credits (Never Expire)</td>
              <td>{pricingData.credits.paid_credits.toLocaleString()}</td>
              <td>{pricingData.credits.paid_credits.toLocaleString()}</td>
              <td><span className="text-primary">✓ Active</span></td>
            </tr>
            <tr>
              <td>Free Credits (Expires in 30 days)</td>
              <td>{(pricingData.credits.free_available || 0).toLocaleString()}</td>
              <td>{((pricingData.credits.free_available || 0) + (pricingData.credits.free_expired || 0)).toLocaleString()}</td>
              <td>{pricingData.credits.free_expired > 0 ? 
                <span className="text-warning">{pricingData.credits.free_expired} expired</span> : 
                <span className="text-success">✓ All active</span>}
              </td>
            </tr>
            <tr className="table-info">
              <td><strong>Total Usable Credits</strong></td>
              <td><strong>{pricingData.credits.total_credits.toLocaleString()}</strong></td>
              <td>-</td>
              <td>
                {quotaStatus.can_proceed ? 
                  <span className="text-success">✓ Ready to use</span> : 
                  <span className="text-danger">⛔ Requires action</span>}
              </td>
            </tr>
          </tbody>
        </Table>
      </section>

      {/* Credit Pack Purchases Section */}
      <section>
        <h2>Purchase Additional Credits</h2>
        <div className="row">
          {pricingData.credit_packs.map((pack) => (
            <div className="col-md-3 mb-3" key={pack.amount}>
              <Card className="h-100 text-center">
                <Card.Body>
                  <Card.Title>{pack.credits_amount} Credits</CardTitle>
                  <Card.Text className="display-6 text-primary">${(pack.price / 100).toFixed(2)}</CardText>
                  <Link to={`/pricing/purchase?pack_size=${pack.amount}`} className="btn btn-outline-primary w-100 mt-2">
                    Buy Now
                  </Link>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Statistics */}
      <section className="mt-5">
        <h2>Credit Usage</h2>
        <div className="row">
          <div className="col-md-6">
            <div className="progress mb-3">
              <div 
                className="progress-bar bg-warning" 
                style={{ width: `${Math.min(100, (pricingData.credits.ai_monthly_used / pricingData.credits.ai_monthly_limit) * 100)}%` }}
                role="progressbar"
              >
                {Math.round((pricingData.credits.ai_monthly_used / pricingData.credits.ai_monthly_limit) * 100)}% used monthly
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="progress">
              <div 
                className="progress-bar bg-info" 
                style={{ width: `${Math.min(100, (pricingData.credits.ai_daily_used / pricingData.credits.ai_daily_limit) * 100)}%` }}
                role="progressbar"
              >
                {Math.round((pricingData.credits.ai_daily_used / pricingData.credits.ai_daily_limit) * 100)}% used daily
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;