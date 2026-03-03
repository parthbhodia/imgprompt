-- User Feedback System Migration
-- Adds tables for storing user feedback, ratings, and reports

-- Create user feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'rating', 'report', 'suggestion')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    categories JSONB,  -- {style_accuracy: 4, prompt_following: 5, overall_quality: 4}
    report_reason VARCHAR(50) CHECK (report_reason IN ('inappropriate', 'low_quality', 'not_matching_prompt', 'copyright', 'other')),
    report_details TEXT,
    improvement_suggestion TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one feedback per user per message per type
    UNIQUE(user_id, message_id, feedback_type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_message_id ON user_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);

-- Create view for feedback statistics per message
CREATE OR REPLACE VIEW message_feedback_stats AS
SELECT 
    message_id,
    COUNT(CASE WHEN feedback_type = 'thumbs_up' THEN 1 END) as thumbs_up_count,
    COUNT(CASE WHEN feedback_type = 'thumbs_down' THEN 1 END) as thumbs_down_count,
    AVG(rating) as average_rating,
    COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rating_count
FROM user_feedback
GROUP BY message_id;

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY user_feedback_select_policy ON user_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_feedback_insert_policy ON user_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_feedback_update_policy ON user_feedback
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_feedback_delete_policy ON user_feedback
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_feedback TO authenticated;

-- Comments
COMMENT ON TABLE user_feedback IS 'Stores user feedback for generated images including ratings, thumbs, reports';
COMMENT ON COLUMN user_feedback.categories IS 'Detailed category ratings: style_accuracy, prompt_following, overall_quality';
COMMENT ON COLUMN user_feedback.feedback_type IS 'Type: thumbs_up, thumbs_down, rating, report, suggestion';

-- Function to get feedback stats for a message (for API)
CREATE OR REPLACE FUNCTION get_message_feedback_stats(p_message_id UUID)
RETURNS TABLE (
    thumbs_up BIGINT,
    thumbs_down BIGINT,
    avg_rating NUMERIC,
    total_ratings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(CASE WHEN feedback_type = 'thumbs_up' THEN 1 END)::BIGINT,
        COUNT(CASE WHEN feedback_type = 'thumbs_down' THEN 1 END)::BIGINT,
        AVG(rating)::NUMERIC(3,2),
        COUNT(CASE WHEN rating IS NOT NULL THEN 1 END)::BIGINT
    FROM user_feedback
    WHERE message_id = p_message_id;
END;
$$ LANGUAGE plpgsql;
