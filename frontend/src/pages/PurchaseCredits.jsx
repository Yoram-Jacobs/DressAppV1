import React, { useState, useEffect } from 'react';
import { Button, Card, Alert, Spinner, Form, Tab, Nav, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const PurchaseCredits = () => {
  const location = useLocation();
  const [creditPacks, setCreditPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payPalState, setPayPalState] = useState({ order: null, status: 'pending' });

  // Get pack_size from query param if present
  const queryParams = new URLSearchParams(location.search);
  const initialPackSize = queryParams.get('pack_size');

  useEffect(() => {
    // Fetch available credit packs and current user info
    const fetchData = async () => {
      try:
        const packsRes = await axios.get('/api/v1/pricing/info');
        setCreditPacks(packsRes.data.credit_packs);
        
        // Auto-select pack if specified in query params
        if (initialPackSize) {
          const pack = packsRes.data.credit_packs.find(p => p.amount.toString() === initialPackSize);
          if (pack) setSelectedPack(pack);
        }
      catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError('Could not load pricing information. Please refresh the page.');
      finally:
        setLoading(false);
      };
    };

    fetchData();
  }, [initialPackSize]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span>Loading purchase options...</span>
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

  // Handle credit pack selection
  const handleSelectPack = (pack) => {
    setSelectedPack(pack);
  };

  // Start PayPal purchase flow
  const handlePurchase = async () => {
    if (!selectedPack) return;

    try:
      setLoading(true);
      
      // Create PayPal order
      const orderRes = await axios.post('/api/v1/ai-credits/purchase', {
        pack_size: selectedPack.amount.toString(),
        currency: 'USD'
      });

      setPayPalState({ order: orderRes.data.order_id, status: 'created' });

      // Simulate payment completion (in production, this would be handled by PayPal webhook)
      setTimeout(async () =>:
        // Capture the order
        const captureRes = await axios.post(
          `/api/v1/ai-credits/purchase/${orderRes.data.purchase_id}/capture`
        );

        setPurchaseResult({
          success: true,
          message: `Successfully purchased ${selectedPack.credits_amount} credits!`,
          credits_added: selectedPack.credits_amount,
          total_cost: (selectedPack.price / 100).toFixed(2)
        });

        // Refresh quota status after successful purchase
        const quotaRes = await axios.get('/api/v1/quota/status');
        setQuotaStatus(quotaRes.data);
      , 2000);

    catch (err) {
      console.error('Purchase failed:', err);
      setError('Payment failed. Please try again or contact support.');
    finally:
      setLoading(false);
    };
  };

  return (
    <div className="purchase-credits-page">
      <h1 className="mb-4">Purchase AI Credits</h1>
      
      {/* Show any warning about low credits if applicable */}
      {!payPalState.order && purchaseResult?.success === false && (
        <Alert variant="danger" className="mb-4">
          {purchaseResult.message}
        </Alert>
      )}

      {/* Success Message */}
      {purchaseResult?.success && (
        <Alert variant="success" className="mb-4">
          <strong>Purchase Successful!</strong> {purchaseResult.message} You now have {purchaseResult.credits_added} additional paid credits that never expire.
        </Alert>
      )}

      {/* Credit Pack Selection Tabs */}
      <Tab.Container defaultActiveTab={initialPackSize || '10'}>
        <Nav variant="pills" className="mb-4">
          {creditPacks.map((pack) => (
            <Nav.Item key={pack.amount}>
              <Nav.Link 
                eventKey={pack.amount.toString()}
                onClick={() => handleSelectPack(pack)}
              >
                {pack.credits_amount} Credits
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <Tab.Content>
          {creditPacks.map((pack) => (
            <Tab.Pane key={pack.amount} tabKey={pack.amount.toString()}>
              <Card className="text-center mb-4">
                <Card.Body>
                  <Card.Title>{pack.credits_amount} Credits</CardTitle>
                  <Card.Text className="display-6 text-primary">
                    ${(pack.price / 100).toFixed(2)}
                  </CardText>
                  <p className="text-muted">Per pack - no expiration</p>
                  <Button 
                    variant="primary" 
                    onClick={() => handleSelectPack(pack)}
                    disabled={selectedPack?.amount === pack.credits_amount}
                  >
                    Select This Pack
                  </Button>
                </Card.Body>
              </Card>
            </Tab.Pane>
          ))}
        </Tab.Content>
      </Tab.Container>

      {/* Purchase Summary & Button */}
      {selectedPack && (
        <Card className="mb-4">
          <Card.Header><h5>Your Selection</h5></CardHeader>
          <Card.Body>
            <Table responsive>
              <tbody>
                <tr>
                  <td>Quantity:</td>
                  <td>{selectedPack.credits_amount} credits</td>
                </tr>
                <tr>
                  <td>Unit Price:</td>
                  <td>${(selectedPack.price / 100).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Total:</td>
                  <td className="fw-bold">${(selectedPack.price / 100).toFixed(2)}</td>
                </tr>
              </tbody>
            </Table>
            <Button 
              variant="success" 
              onClick={handlePurchase}
              disabled={loading}
              className="w-100 mt-3"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Processing...
                </>
              ) : (
                `Purchase Now - $${(selectedPack.price / 100).toFixed(2)}`
              )}
            </Button>
          </Card.Body>
        </Card>
      )}

      {/* Credit Pack Benefits Section */}
      <section className="mt-5">
        <h2>Why Choose DressApp Credits?</h2>
        <Row>
          <Col md={4} className="mb-4">
            <Card>
              <Card.Body>
                <Card.Title>🎯 Always Available</CardTitle>
                <Card.Text>Paid credits never expire - use them whenever you need.</CardText>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card>
              <Card.Body>
                <Card.Title>💰 Bulk Discounts</CardTitle>
                <Card.Text>Buy larger packs and get better value per credit.</CardText>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card>
              <Card.Body>
                <Card.Title>⚡ Instant Access</CardTitle>
                <Card.Text>Purchase today and get immediate access to premium AI features.</CardText>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      {/* Back Link */}
      <div className="mt-4">
        <Link to="/pricing" className="btn btn-secondary">
          ← Back to Pricing Plans
        </Link>
      </div>
    </div>
  );
};

export default PurchaseCredits;