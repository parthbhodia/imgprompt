import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Flag, Star, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitFeedback, type FeedbackSubmitRequest } from "@/lib/api";

interface FeedbackWidgetProps {
  messageId: string;
  token: string | null;
  imageUrl?: string;
  onFeedbackSubmitted?: () => void;
}

export function FeedbackWidget({ messageId, token, imageUrl, onFeedbackSubmitted }: FeedbackWidgetProps) {
  const [userRating, setUserRating] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [detailedRatings, setDetailedRatings] = useState({
    style_accuracy: 0,
    prompt_following: 0,
    overall_quality: 0,
  });
  const [showDetailedRating, setShowDetailedRating] = useState(false);

  const handleThumb = async (type: "thumbs_up" | "thumbs_down") => {
    if (!token) {
      toast.error("Sign in to leave feedback");
      return;
    }

    try {
      await submitFeedback(token, {
        message_id: messageId,
        feedback_type: type,
      });
      setHasSubmitted(true);
      toast.success(type === "thumbs_up" ? "Thanks for the feedback!" : "Thanks, we'll improve!");
      onFeedbackSubmitted?.();
    } catch {
      toast.error("Failed to submit feedback");
    }
  };

  const handleRating = async (rating: number) => {
    if (!token) {
      toast.error("Sign in to rate");
      return;
    }

    setUserRating(rating);
    
    // Show detailed ratings for 4-5 stars
    if (rating >= 4) {
      setShowDetailedRating(true);
    }

    try {
      await submitFeedback(token, {
        message_id: messageId,
        feedback_type: "rating",
        rating,
      });
    } catch {
      toast.error("Failed to submit rating");
    }
  };

  const handleDetailedRating = async () => {
    if (!token) return;

    try {
      await submitFeedback(token, {
        message_id: messageId,
        feedback_type: "rating",
        rating: userRating,
        categories: detailedRatings,
      });
      setHasSubmitted(true);
      setShowDetailedRating(false);
      toast.success("Thanks for the detailed feedback!");
      onFeedbackSubmitted?.();
    } catch {
      toast.error("Failed to submit ratings");
    }
  };

  const handleReport = async () => {
    if (!token) {
      toast.error("Sign in to report");
      return;
    }

    if (!reportReason) {
      toast.error("Please select a reason");
      return;
    }

    try {
      await submitFeedback(token, {
        message_id: messageId,
        feedback_type: "report",
        report_reason: reportReason as FeedbackSubmitRequest["report_reason"],
        report_details: reportDetails,
      });
      setIsReportOpen(false);
      setHasSubmitted(true);
      toast.success("Report submitted. Thanks for keeping the community safe!");
      onFeedbackSubmitted?.();
    } catch {
      toast.error("Failed to submit report");
    }
  };

  const handleSuggestion = async () => {
    if (!token) {
      toast.error("Sign in to submit suggestions");
      return;
    }

    if (!suggestion.trim()) {
      toast.error("Please enter your suggestion");
      return;
    }

    try {
      await submitFeedback(token, {
        message_id: messageId,
        feedback_type: "suggestion",
        improvement_suggestion: suggestion,
      });
      setIsSuggestionOpen(false);
      setSuggestion("");
      toast.success("Suggestion submitted!");
      onFeedbackSubmitted?.();
    } catch {
      toast.error("Failed to submit suggestion");
    }
  };

  if (hasSubmitted && !showDetailedRating) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Quick Thumbs */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-green-500/20 hover:text-green-600"
            onClick={() => handleThumb("thumbs_up")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-500/20 hover:text-red-600"
            onClick={() => handleThumb("thumbs_down")}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Star Rating */}
        <div className="flex items-center gap-1 ml-2 border-l pl-2 border-border">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded transition-colors",
                star <= userRating
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-muted-foreground/30 hover:text-yellow-400"
              )}
              onClick={() => handleRating(star)}
            >
              <Star className={cn("h-3.5 w-3.5", star <= userRating && "fill-current")} />
            </button>
          ))}
        </div>

        {/* Report Dialog */}
        <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-orange-500/20 hover:text-orange-600 ml-auto"
            >
              <Flag className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {imageUrl && (
                <img src={imageUrl} alt="Report" className="rounded-lg max-h-48 w-auto mx-auto" />
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "inappropriate", label: "Inappropriate" },
                    { value: "low_quality", label: "Low Quality" },
                    { value: "not_matching_prompt", label: "Not Matching Prompt" },
                    { value: "copyright", label: "Copyright" },
                    { value: "other", label: "Other" },
                  ].map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => setReportReason(reason.value)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm border transition-colors",
                        reportReason === reason.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Details (optional)</label>
                <Textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Please provide more details about the issue..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsReportOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleReport}>
                  Submit Report
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suggestion Dialog */}
        <Dialog open={isSuggestionOpen} onOpenChange={setIsSuggestionOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-blue-500/20 hover:text-blue-600"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Suggest Improvement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  What would make this better?
                </label>
                <Textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="e.g., 'Better lighting', 'More realistic proportions', 'Different color palette'..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsSuggestionOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSuggestion}>
                  Submit Suggestion
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Detailed Rating Panel */}
      {showDetailedRating && (
        <div className="mt-2 p-3 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rate specific aspects:</span>
            <button
              onClick={() => setShowDetailedRating(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Style Accuracy</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={cn(
                      "transition-colors",
                      star <= detailedRatings.style_accuracy ? "text-yellow-500" : "text-muted-foreground/30"
                    )}
                    onClick={() => setDetailedRatings({ ...detailedRatings, style_accuracy: star })}
                  >
                    <Star className={cn("h-3 w-3", star <= detailedRatings.style_accuracy && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Prompt Following</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={cn(
                      "transition-colors",
                      star <= detailedRatings.prompt_following ? "text-yellow-500" : "text-muted-foreground/30"
                    )}
                    onClick={() => setDetailedRatings({ ...detailedRatings, prompt_following: star })}
                  >
                    <Star className={cn("h-3 w-3", star <= detailedRatings.prompt_following && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Quality</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={cn(
                      "transition-colors",
                      star <= detailedRatings.overall_quality ? "text-yellow-500" : "text-muted-foreground/30"
                    )}
                    onClick={() => setDetailedRatings({ ...detailedRatings, overall_quality: star })}
                  >
                    <Star className={cn("h-3 w-3", star <= detailedRatings.overall_quality && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <Button size="sm" className="w-full" onClick={handleDetailedRating}>
            Submit Detailed Rating
          </Button>
        </div>
      )}
    </div>
  );
}
